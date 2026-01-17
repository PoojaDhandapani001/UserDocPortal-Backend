import Busboy from "busboy";
import fs from "fs";
import { fileTypeFromBuffer } from "file-type";
import path from "path";
import Document from "../models/Document.js";
import cloudinary from "../utils/cloudinary.js";



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


/* ======================
   UPLOAD DOCUMENT
====================== */
const uploadDocument = (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  });

  let originalName = "";
  let fileBuffer = [];
  let rejected = false;

  busboy.on("file", (fieldname, file, info) => {
    originalName = info.filename;

    file.on("data", (chunk) => fileBuffer.push(chunk));

    file.on("end", async () => {
      if (rejected) return;

      const buffer = Buffer.concat(fileBuffer);

      // Validate PDF
      if (!info.mimeType.includes("pdf")) {
        rejected = true;
        return res.status(400).json({ message: "Only PDF allowed" });
      }

      // Upload to Cloudinary as RAW file
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "raw", folder: "documents" },
        async (error, result) => {
          if (error) return res.status(500).json({ message: "Upload failed", error });

          const doc = await Document.create({
            filename: result.public_id,   // Cloudinary public ID
            originalName,
            uploader: req.user.id,
            size: buffer.length,
            url: result.secure_url,      // Direct URL for viewing
          });

          // Socket event for frontend
          req.app.get("io").emit("document:created", doc);

          res.json({ message: "Upload successful", doc });
        }
      );

      stream.end(buffer);
    });
  });

  busboy.on("error", () => res.status(500).json({ message: "Upload failed" }));

  req.pipe(busboy);
};

/* ======================
   UPDATE DOCUMENT
====================== */
const updateDocument = async (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Document not found" });

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: 500 * 1024 * 1024 },
  });

  let newName = null;
  let fileBuffer = [];
  let hasFile = false;
  let rejected = false;

  busboy.on("field", (name, value) => {
    if (name === "originalName") newName = value;
  });

  busboy.on("file", (fieldname, file, info) => {
    hasFile = true;

    file.on("data", (chunk) => fileBuffer.push(chunk));

    file.on("end", async () => {
      if (rejected) return;

      const buffer = Buffer.concat(fileBuffer);

      // Validate PDF
      if (!info.mimeType.includes("pdf")) {
        rejected = true;
        return res.status(400).json({ message: "Only PDF allowed" });
      }

      // Upload new file to Cloudinary
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "raw", folder: "documents" },
        async (error, result) => {
          if (error) return res.status(500).json({ message: "Upload failed", error });

          // Delete old file from Cloudinary if exists
          if (doc.filename) {
            cloudinary.uploader.destroy(doc.filename, { resource_type: "raw" });
          }

          // Update document metadata
          doc.filename = result.public_id;
          doc.url = result.secure_url;
          doc.size = buffer.length;

          if (newName) doc.originalName = newName;

          await doc.save();

          req.app.get("io").emit("document:updated", doc);

          res.json({ message: "Updated", doc });
        }
      );

      stream.end(buffer);
    });
  });

  busboy.on("finish", async () => {
    // Only renaming (no new file)
    if (!hasFile && newName && newName !== doc.originalName) {
      doc.originalName = newName;
      await doc.save();
      req.app.get("io").emit("document:updated", doc);
      res.json({ message: "Updated", doc });
    }
  });

  busboy.on("error", () => res.status(500).json({ message: "Update failed" }));

  req.pipe(busboy);
};



export { getNameFromEmail, uploadDocument, updateDocument };