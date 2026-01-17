import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { auth } from "../middleware/auth.js";
import Document from "../models/Document.js";


const router = express.Router();

// Storage config (disk storage)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join("./uploads");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

// Validate PDF and limit size
const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDFs allowed"));
    }
    cb(null, true);
  }
});

// Upload document route (Owner/Admin only)
router.post("/upload", auth, async (req, res, next) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    const doc = await Document.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      uploader: req.user.id,
      size: req.file.size
    });
    const io = req.app.get("io");

io.to("admins").emit("document-updated", {
  action: "uploaded",
  document: savedDoc,
});


    res.json({ message: "Upload successful", document: doc });
  });
});


// Needed to handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List documents route
router.get("/documents", auth, async (req, res) => {
  let docs;
  if (req.user.role === "VIEWER") {
    // Viewers only see limited info
    docs = await Document.find().select("originalName filename createdAt");
  } else {
    // Owners/Admins see full info
    docs = await Document.find().populate("uploader", "email role");
  }
  res.json(docs);
});

// Serve / view PDF
router.get("/documents/:id", auth, async (req, res) => {
  const { id } = req.params;
  const doc = await Document.findById(id);

  if (!doc) return res.status(404).json({ message: "Document not found" });

  // Check role
  if (req.user.role === "VIEWER") {
    // Viewer: allowed
  } else if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const filePath = path.join(__dirname, "../../uploads", doc.filename);
  res.sendFile(filePath);
});

router.delete("/documents/:id", auth, async (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const doc = await Document.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: "Not found" });

  const io = req.app.get("io");
  io.to("admins").emit("document-updated", {
    action: "deleted",
    documentId: doc._id,
  });

  res.json({ message: "Document deleted" });
});


export default router;
