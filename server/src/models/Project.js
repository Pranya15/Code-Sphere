import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true },
    key: { type: String, required: true },
    description: String,
    status: { type: String, enum: ["Planning", "Active", "Paused", "Done"], default: "Active" },
    color: { type: String, default: "#14b8a6" },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    startDate: Date,
    dueDate: Date,
    repositoryUrl: String
  },
  { timestamps: true }
);

projectSchema.index({ workspace: 1, key: 1 }, { unique: true });
projectSchema.index({ name: "text", description: "text", key: "text" });

export default mongoose.model("Project", projectSchema);
