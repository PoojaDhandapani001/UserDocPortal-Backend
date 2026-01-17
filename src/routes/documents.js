import express from "express";
import { auth } from "../middleware/auth.js";
import Document from "../models/Document.js";
import cloudinary from "../utils/cloudinary.js"; // Cloudinary config
import { uploadDocument, updateDocument } from "../utils/utilities.js";

const router = express.Router();

/**
 * LIST DOCUMENTS
 */
router.get("/", auth, async (req, res) => {
  const docs = await Document.find().sort({ createdAt: -1 });
  res.json(docs);
});

/**
 * VIEW DOCUMENT (PDF via Cloudinary URL)
 */
/**
 * VIEW DOCUMENT (PDF)
 */
router.get("/:id/view", auth, async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Document not found" });

  // Redirect to Cloudinary URL (opens in browser)
  res.redirect(doc.url);
});




/**
 * UPLOAD
 */
router.post("/upload", auth, uploadDocument);

/**
 * UPDATE (rename / replace)
 */
router.patch("/:id", auth, updateDocument);

/**
 * DELETE
 */
router.delete("/:id", auth, async (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).end();

  try {
    // Delete file from Cloudinary
    if (doc.publicId) {
      await cloudinary.uploader.destroy(doc.publicId, { resource_type: "raw" });
    }

    await doc.deleteOne();

    // 🔥 socket update
    req.app.get("io").emit("document:deleted", doc._id.toString());

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

export default router;
