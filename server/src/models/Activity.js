import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    targetType: String,
    targetId: mongoose.Schema.Types.ObjectId,
    message: { type: String, required: true },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

activitySchema.index({ message: "text", type: "text" });

export default mongoose.model("Activity", activitySchema);
