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

export default mongoose.model("User", userSchema);
