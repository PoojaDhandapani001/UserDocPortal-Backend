import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema({
    email: { type: String, required: true },
    role: { type: String, required: true },
    previewUrl: { type: String},
    token: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "EXPIRED"],
      default: "PENDING",
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true });

export default mongoose.model("Invitation", invitationSchema);
