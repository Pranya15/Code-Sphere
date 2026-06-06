import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: String,
    razorpaySignature: String,
    invoiceNumber: String,
    invoiceUrl: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["pending", "completed", "failed", "refunded"], default: "pending" },
    plan: { type: String, enum: ["free", "pro"], required: true },
    paymentMethod: { type: String, enum: ["razorpay", "upi", "phonepe", "gpay", "card", "netbanking", "wallet"], default: "razorpay" },
    billingPeriod: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ razorpayOrderId: 1 }, { unique: true });

export default mongoose.model("Payment", paymentSchema);
