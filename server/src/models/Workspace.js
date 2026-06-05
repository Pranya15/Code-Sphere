import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["Owner", "Admin", "Member", "Viewer"], default: "Member" },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    logo: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [memberSchema],
    settings: {
      visibility: { type: String, enum: ["private", "team"], default: "private" },
      defaultRole: { type: String, enum: ["Member", "Viewer"], default: "Member" }
    }
  },
  { timestamps: true }
);

export default mongoose.model("Workspace", workspaceSchema);
