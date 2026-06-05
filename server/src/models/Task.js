import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

const historySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    from: String,
    to: String
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true },
    description: String,
    status: { type: String, enum: ["To Do", "In Progress", "In Review", "Done"], default: "To Do" },
    priority: { type: String, enum: ["P0", "P1", "P2"], default: "P2" },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    labels: [String],
    dueDate: Date,
    attachments: [{ name: String, url: String, type: String, size: Number }],
    comments: [commentSchema],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    history: [historySchema],
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

taskSchema.index({ title: "text", description: "text", labels: "text" });
taskSchema.index({ workspace: 1, status: 1, dueDate: 1 });

export default mongoose.model("Task", taskSchema);
