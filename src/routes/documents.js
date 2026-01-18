import express from "express";
import fs from "fs";
import path from "path";
import { auth } from "../middleware/auth.js";
import Document from "../models/Document.js";
import cloudinary from "../utils/cloudinary.js"; // Cloudinary config
import { uploadDocument, updateDocument, UPLOAD_DIR } from "../utils/utilities.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

/**
 * LIST DOCUMENTS
 * Adds `url` field for local files
 */
router.get("/", auth, async (req, res) => {
  const docs = await Document.find().sort({ createdAt: -1 }).lean();

  const normalizedDocs = docs.map((doc) => ({
    ...doc,
    url:
      doc.storage === "cloudinary"
        ? doc.url
        : `${process.env.BACKEND_URL}/documents/file/${doc.filename}`,
  }));

  res.json(normalizedDocs);
});

/**
 * VIEW DOCUMENT
 * Redirects to Cloudinary URL or serves local file
 */
router.get("/:id/view", auth, async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Document not found" });

  if (doc.storage === "cloudinary") {
    return res.redirect(doc.url);
  }

  const filePath = path.join(UPLOAD_DIR, doc.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  res.sendFile(filePath);
});

/**
 * SERVE LOCAL FILES
 */

router.get("/file/:filename", (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return res.status(400).json({ message: "Invalid filename" });
  }

  const filePath = path.resolve(UPLOAD_DIR, filename); // make absolute
console.log(filePath)
  // Check file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  // Set headers for inline PDF viewing
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

  // Stream file directly
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      if (!res.headersSent) res.status(500).json({ message: "Failed to send file" });
    }
  });
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
 * DELETE DOCUMENT
 */
router.delete("/:id", auth, async (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).end();

  try {
    // Delete file from Cloudinary
    if (doc.storage === "cloudinary" && doc.filename) {
      await cloudinary.uploader.destroy(doc.filename, { resource_type: "raw" });
    }

    // Delete local file
    if (doc.storage === "local" && doc.path && fs.existsSync(doc.path)) {
      fs.unlinkSync(doc.path);
    }

    await doc.deleteOne();

    // 🔥 socket update
    req.app.get("io")?.emit("document:deleted", doc._id.toString());

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

export default router;
