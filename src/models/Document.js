import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  size: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Document", documentSchema);
