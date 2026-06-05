import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 8, select: false },
    avatar: String,
    bio: String,
    skills: [String],
    github: String,
    linkedin: String,
    providers: {
      google: { id: String, email: String },
      microsoft: { id: String, email: String },
      github: { id: String, username: String, email: String, profileUrl: String },
      linkedin: { id: String, profileUrl: String, email: String },
      apple: { id: String, email: String }
    },
    lastSeenAt: Date,
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    preferences: {
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true }
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      sessions: [{ device: String, ip: String, lastActiveAt: Date }]
    }
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", userSchema);
