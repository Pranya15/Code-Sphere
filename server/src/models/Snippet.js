import mongoose from "mongoose";

const snippetSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, required: true },
    description: String,
    language: { type: String, enum: ["javascript", "python", "java", "cpp", "go"], required: true },
    code: { type: String, required: true },
    tags: [String],
    folder: String,
    visibility: { type: String, enum: ["workspace", "private", "public"], default: "workspace" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    copiedCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

snippetSchema.index({ title: "text", description: "text", code: "text", tags: "text" }, { language_override: "searchLanguage" });

export default mongoose.model("Snippet", snippetSchema);
