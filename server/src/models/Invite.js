import mongoose from "mongoose";

const inviteSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    targetType: { type: String, enum: ["email", "link"], default: "email" },
    target: { type: String, required: true, lowercase: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    github: String,
    linkedin: String,
    role: { type: String, enum: ["Admin", "Member", "Viewer"], default: "Member" },
    token: { type: String, required: true, unique: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    acceptedAt: Date,
    expiresAt: { type: Date, required: true },
    delivery: {
      channel: { type: String, enum: ["email", "link"], default: "email" },
      status: { type: String, enum: ["queued", "sent", "manual"], default: "queued" },
      sentAt: Date,
      message: String
    }
  },
  { timestamps: true }
);

export default mongoose.model("Invite", inviteSchema);
