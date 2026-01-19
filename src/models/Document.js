import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  storage: { type: String, enum: ["local", "cloudinary"], required: true },
  url: { type: String },  // <-- Cloudinary URL
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  size: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

documentSchema.index({ uploader: 1, createdAt: -1 });

export default mongoose.model("Document", documentSchema);
