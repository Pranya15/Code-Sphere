import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: String,
    readAt: Date,
    link: String
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
