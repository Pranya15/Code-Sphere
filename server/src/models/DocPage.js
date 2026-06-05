import mongoose from "mongoose";

const versionSchema = new mongoose.Schema(
  {
    content: String,
    editor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    message: String,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const docPageSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "DocPage" },
    title: { type: String, required: true },
    icon: { type: String, default: "FileText" },
    content: { type: String, default: "" },
    linkedPages: [{ type: mongoose.Schema.Types.ObjectId, ref: "DocPage" }],
    images: [{ name: String, url: String }],
    versionHistory: [versionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

docPageSchema.index({ title: "text", content: "text" });

export default mongoose.model("DocPage", docPageSchema);
