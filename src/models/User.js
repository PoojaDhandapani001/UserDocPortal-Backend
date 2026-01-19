import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: {
    type: String,
    enum: ["OWNER", "ADMIN", "VIEWER"]
  },
  status: {
    type: String,
    enum: ["PENDING", "ACTIVE"],
    default: "ACTIVE"
  }
});

/* INDEXES */
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1, role: 1 });

export default mongoose.model("User", userSchema);
