import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import Razorpay from "razorpay";
import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { wrapAsyncRouter } from "../utils/wrapAsyncRouter.js";

const router = express.Router();
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "")}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function hasRazorpayConfig() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    !process.env.RAZORPAY_KEY_ID.includes("placeholder") &&
    !process.env.RAZORPAY_KEY_SECRET.includes("placeholder")
  );
}

function razorpayClient() {
  if (!hasRazorpayConfig()) {
    throw Object.assign(new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env."), {
      status: 503,
      missing: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
    });
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

function invoiceNumber() {
  return `CS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

router.post("/uploads", requireAuth, upload.single("file"), (req, res) => {
  res.status(201).json({ name: req.file.originalname, url: `/uploads/${req.file.filename}`, type: req.file.mimetype, size: req.file.size });
});

router.get("/activity/:workspaceId", requireAuth, requireWorkspaceRole, async (req, res) => {
  res.json(await Activity.find({ workspace: req.workspace._id }).populate("actor", "name email avatar").sort("-createdAt").limit(100));
});

router.get("/notifications", requireAuth, async (req, res) => {
  res.json(await Notification.find({ user: req.user._id }).sort("-createdAt").limit(100));
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  res.json(await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { readAt: new Date() }, { new: true }));
});

router.get("/team/:workspaceId", requireAuth, requireWorkspaceRole, async (req, res) => {
  const memberIds = req.workspace.members.map((member) => member.user.toString());
  const ids = [...new Set([req.workspace.owner.toString(), ...memberIds])];
  const users = await User.find({ _id: { $in: ids } }).select("name email avatar bio skills github linkedin plan lastSeenAt providers");
  res.json(users.map((user) => ({
    ...user.toObject(),
    role: user._id.toString() === req.workspace.owner.toString()
      ? "Owner"
      : req.workspace.members.find((member) => member.user.toString() === user._id.toString())?.role || "Member"
  })));
});

router.get("/billing", requireAuth, async (req, res) => {
  const payments = await Payment.find({ user: req.user._id }).sort("-createdAt").limit(10);
  res.json({
    currentPlan: req.user.plan,
    plans: [
      { 
        id: "free", 
        name: "Free", 
        price: 0, 
        monthlyPrice: 0,
        yearlyPrice: 0,
        limits: ["2 workspaces", "5 projects per workspace", "5 members"], 
        features: ["Tasks", "Docs", "Snippets", "Realtime collaboration"] 
      },
      { 
        id: "pro", 
        name: "Pro", 
        price: 19, 
        monthlyPrice: 499,
        yearlyPrice: 4999,
        currency: "INR",
        limits: ["Unlimited workspaces", "Unlimited projects", "Unlimited members"], 
        features: ["All Free features", "AI Assistant", "AI Search", "AI Code Review", "Advanced analytics"] 
      }
    ],
    paymentMethods: [
      { id: "upi", name: "UPI", configured: hasRazorpayConfig() },
      { id: "gpay", name: "Google Pay", configured: hasRazorpayConfig() },
      { id: "phonepe", name: "PhonePe", configured: hasRazorpayConfig() },
      { id: "card", name: "Debit/Credit Cards", configured: hasRazorpayConfig() },
      { id: "netbanking", name: "Net Banking", configured: hasRazorpayConfig() }
    ],
    razorpayConfigured: hasRazorpayConfig(),
    missingPaymentEnv: hasRazorpayConfig() ? [] : ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    paymentHistory: payments
  });
});

router.post("/billing/create-order", requireAuth, async (req, res) => {
  try {
    const { plan, billingPeriod = "monthly", paymentMethod = "razorpay" } = req.body;
    
    if (!["free", "pro"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    if (plan === "free") {
      const user = await User.findByIdAndUpdate(req.user._id, { plan: "free" }, { new: true }).select("-password");
      return res.json({ user, message: "Switched to Free plan" });
    }

    const amount = billingPeriod === "yearly" ? 499900 : 49900; // in paise
    const currency = "INR";

    const options = {
      amount: amount,
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        plan: plan,
        billingPeriod: billingPeriod
      }
    };

    const order = await razorpayClient().orders.create(options);

    await Payment.create({
      user: req.user._id,
      razorpayOrderId: order.id,
      amount: amount / 100,
      currency: currency,
      status: "pending",
      plan: plan,
      paymentMethod,
      billingPeriod,
      metadata: { billingPeriod, razorpayOrder: order }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(error.status || 500).json({ message: error.message || "Failed to create payment order", missing: error.missing || [] });
  }
});

router.post("/billing/verify-payment", requireAuth, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, billingPeriod } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    if (!hasRazorpayConfig()) {
      return res.status(503).json({
        message: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.",
        missing: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      await Payment.findOneAndUpdate({ razorpayOrderId, user: req.user._id }, { status: "failed" });
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId, user: req.user._id },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: "completed",
        invoiceNumber: invoiceNumber(),
        invoiceUrl: `/api/billing/invoices/${razorpayOrderId}`
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Update user plan
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { plan: payment.plan },
      { new: true }
    ).select("-password");

    res.json({ 
      user, 
      payment, 
      message: "Payment successful! Plan upgraded to Pro." 
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ message: "Payment verification failed", error: error.message });
  }
});

router.post("/billing/upgrade", requireAuth, async (req, res) => {
  const plan = req.body.plan === "free" ? "free" : "pro";
  const user = await User.findByIdAndUpdate(req.user._id, { plan }, { new: true }).select("-password");
  res.json({ user, message: plan === "free" ? "Switched to Free plan" : "Plan upgraded to Pro. Connect Razorpay before production billing." });
});

router.post("/billing/payment-failed", requireAuth, async (req, res) => {
  const { razorpayOrderId, reason } = req.body;
  if (!razorpayOrderId) return res.status(400).json({ message: "razorpayOrderId is required" });
  const payment = await Payment.findOneAndUpdate(
    { user: req.user._id, razorpayOrderId },
    { status: "failed", metadata: { failureReason: reason || "Payment failed" } },
    { new: true }
  );
  if (!payment) return res.status(404).json({ message: "Payment record not found" });
  res.json({ payment, message: "Payment failure recorded" });
});

router.get("/billing/invoices/:orderId", requireAuth, async (req, res) => {
  const payment = await Payment.findOne({ user: req.user._id, razorpayOrderId: req.params.orderId });
  if (!payment) return res.status(404).json({ message: "Invoice not found" });
  res.json({
    invoiceNumber: payment.invoiceNumber || payment._id.toString(),
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    plan: payment.plan,
    billingPeriod: payment.billingPeriod,
    paidAt: payment.updatedAt,
    paymentId: payment.razorpayPaymentId
  });
});

router.post("/billing/webhook", async (req, res) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return res.status(503).json({ message: "RAZORPAY_WEBHOOK_SECRET is not configured" });
  const signature = req.headers["x-razorpay-signature"];
  const body = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
  if (signature !== expected) return res.status(400).json({ message: "Invalid webhook signature" });
  const event = req.body;
  if (event.event === "payment.captured") {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: orderId },
      {
        razorpayPaymentId: paymentEntity?.id,
        status: "completed",
        paymentMethod: paymentEntity?.method || "razorpay",
        invoiceNumber: invoiceNumber(),
        invoiceUrl: `/api/billing/invoices/${orderId}`,
        metadata: { webhookEvent: event.event, paymentEntity }
      },
      { new: true }
    );
    if (payment) await User.updateOne({ _id: payment.user }, { plan: payment.plan });
  }
  if (event.event === "payment.failed") {
    const paymentEntity = event.payload?.payment?.entity;
    await Payment.findOneAndUpdate(
      { razorpayOrderId: paymentEntity?.order_id },
      { status: "failed", metadata: { webhookEvent: event.event, error: paymentEntity?.error_description } }
    );
  }
  res.json({ ok: true });
});

export default wrapAsyncRouter(router);
