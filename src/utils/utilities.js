import Busboy from "busboy";
import fs from "fs";
import path from "path";
import Document from "../models/Document.js";
import cloudinary from "../utils/cloudinary.js";

// Ensure UPLOAD_DIR exists
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Upload a new document
 */
const uploadDocument = (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role))
    return res.status(403).json({ message: "Forbidden" });

  const busboy = Busboy({ headers: req.headers, limits: { fileSize: 500 * 1024 * 1024 } });

  let originalName = "";
  let rejected = false;

  busboy.on("file", (fieldname, file, info) => {
    if (!info.mimeType.includes("pdf")) {
      rejected = true;
      file.resume();
      return res.status(400).json({ message: "Only PDF allowed" });
    }

    originalName = info.filename;

    const sizeLimit = Number(process.env.CLOUDINARY_LIMIT || 10_000_000);

    // Decide where to store: Cloudinary (small) or Local FS (large)
    if (info.size && info.size <= sizeLimit) {
      // Small file → buffer + Cloudinary
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        if (rejected) return;
        const buffer = Buffer.concat(chunks);
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "raw", folder: "documents" },
          async (err, result) => {
            if (err) return res.status(500).json({ message: "Cloudinary upload failed", error: err });
            const doc = await Document.create({
              originalName,
              filename: result.public_id,
              url: result.secure_url,
              size: buffer.length,
              uploader: req.user.id,
              storage: "cloudinary",
            });
            req.app.get("io")?.emit("document:created", doc);
            res.json({ message: "Upload successful", doc });
          }
        );
        stream.end(buffer);
      });
    } else {
      // Large file → Local FS
      const localName = `${Date.now()}-${Math.random().toString(36)}.pdf`;
      const localPath = path.join(UPLOAD_DIR, localName);
      const writeStream = fs.createWriteStream(localPath);
      let totalSize = 0;

      file.on("data", (chunk) => totalSize += chunk.length);
      file.pipe(writeStream);

      writeStream.on("finish", async () => {
        const doc = await Document.create({
          originalName,
          filename: localName,
          path: localPath,
          size: totalSize,
          uploader: req.user.id,
          storage: "local",
          url: `${process.env.BACKEND_URL}/documents/file/${localName}`,
        });
        req.app.get("io")?.emit("document:created", doc);
        res.json({ message: "Upload successful", doc });
      });

      writeStream.on("error", (err) => {
        console.error("File write error:", err);
        res.status(500).json({ message: "Upload failed", error: err });
      });
    }
  });

  busboy.on("error", (err) => {
    console.error("Busboy error:", err);
    res.status(500).json({ message: "Upload failed", error: err });
  });

  req.pipe(busboy);
};

/**
 * Update existing document
 */
const updateDocument = async (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role))
    return res.status(403).json({ message: "Forbidden" });

  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Document not found" });

  const busboy = Busboy({ headers: req.headers, limits: { fileSize: 500 * 1024 * 1024 } });

  let newName = null;

  busboy.on("field", (name, value) => {
    if (name === "originalName") newName = value;
  });

  busboy.on("file", (fieldname, file, info) => {
    if (!info.mimeType.includes("pdf")) {
      file.resume();
      return res.status(400).json({ message: "Only PDF allowed" });
    }

    const sizeLimit = Number(process.env.CLOUDINARY_LIMIT || 10_000_000);

    if (info.size && info.size <= sizeLimit) {
      // Small file → Cloudinary
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", async () => {
        const buffer = Buffer.concat(chunks);

        // Delete old file
        if (doc.storage === "local" && doc.path && fs.existsSync(doc.path)) fs.unlinkSync(doc.path);
        if (doc.storage === "cloudinary") await cloudinary.uploader.destroy(doc.filename, { resource_type: "raw" });

        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "raw", folder: "documents" },
          async (err, result) => {
            if (err) return res.status(500).json({ message: "Cloudinary upload failed", error: err });
            doc.filename = result.public_id;
            doc.url = result.secure_url;
            doc.storage = "cloudinary";
            doc.size = buffer.length;
            if (newName) doc.originalName = newName;
            await doc.save();
            req.app.get("io")?.emit("document:updated", doc);
            res.json({ message: "Document updated", doc });
          }
        );
        stream.end(buffer);
      });
    } else {
      // Large file → Local FS
      const localName = `${Date.now()}-${Math.random().toString(36)}.pdf`;
      const localPath = path.join(UPLOAD_DIR, localName);
      const writeStream = fs.createWriteStream(localPath);
      let totalSize = 0;

      file.on("data", (chunk) => totalSize += chunk.length);
      file.pipe(writeStream);

      writeStream.on("finish", async () => {
        // Delete old file
        if (doc.storage === "local" && doc.path && fs.existsSync(doc.path)) fs.unlinkSync(doc.path);
        if (doc.storage === "cloudinary") await cloudinary.uploader.destroy(doc.filename, { resource_type: "raw" });

        doc.filename = localName;
        doc.path = localPath;
        doc.storage = "local";
        doc.size = totalSize;
        doc.url = `${process.env.BACKEND_URL}/documents/file/${localName}`;
        if (newName) doc.originalName = newName;
        await doc.save();
        req.app.get("io")?.emit("document:updated", doc);
        res.json({ message: "Document updated", doc });
      });

      writeStream.on("error", (err) => {
        console.error("File write error:", err);
        res.status(500).json({ message: "Update failed", error: err });
      });
    }
  });

  busboy.on("error", (err) => {
    console.error("Busboy error:", err);
    res.status(500).json({ message: "Update failed", error: err });
  });

  req.pipe(busboy);
};



const getNameFromEmail = (email) => {
  if (!email) return "";

  // take part before @
  const localPart = email.split("@")[0];

  // replace dots, underscores, hyphens with spaces
  const name = localPart.replace(/[._-]+/g, " ");

  // capitalize first letter of each word
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export { UPLOAD_DIR, uploadDocument, updateDocument, getNameFromEmail };
