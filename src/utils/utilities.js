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
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 524288000);
const CLOUDINARY_LIMIT = Number(process.env.CLOUDINARY_LIMIT || 10_000_000);



const uploadDocument = (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: MAX_FILE_SIZE },
  });

  let originalName = "";
  let totalSize = 0;
  let rejected = false;
  const chunks = [];

  busboy.on("file", (fieldname, file, info) => {
    if (info.mimeType !== "application/pdf") {
      rejected = true;
      file.resume();
      return res.status(400).json({ message: "Only PDF allowed" });
    }

    originalName = info.filename;

    file.on("data", (chunk) => {
      totalSize += chunk.length;

      if (totalSize > MAX_FILE_SIZE) {
        rejected = true;
        file.resume();
        return res.status(413).json({ message: "File exceeds 500MB limit" });
      }

      if (totalSize <= CLOUDINARY_LIMIT) {
        chunks.push(chunk);
      }
    });

    file.on("end", async () => {
      if (rejected) return;

      // ---------- SMALL FILE → CLOUDINARY ----------
      if (totalSize <= CLOUDINARY_LIMIT) {
        const buffer = Buffer.concat(chunks);

        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "raw", folder: "documents" },
          async (err, result) => {
            if (err) {
              return res.status(500).json({ message: "Cloudinary upload failed", err });
            }

            const doc = await Document.create({
              originalName,
              filename: result.public_id,
              cloudUrl: result.secure_url,
              size: totalSize,
              uploader: req.user.id,
              storage: "cloudinary",
            });

            req.app.get("io")?.emit("document:created", doc);
            res.json({ message: "Upload successful", doc });
          }
        );

        stream.end(buffer);
      }

      // ---------- LARGE FILE → LOCAL ----------
      else {
        const localName = `${Date.now()}-${Math.random().toString(36)}.pdf`;
        const localPath = path.join(UPLOAD_DIR, localName);

        const writeStream = fs.createWriteStream(localPath);
        file.pipe(writeStream);

        writeStream.on("finish", async () => {
          const doc = await Document.create({
            originalName,
            filename: localName,
            path: localPath,
            size: totalSize,
            uploader: req.user.id,
            storage: "local",
            cloudUrl: `${process.env.BACKEND_URL}/documents/file/${localName}`,
          });

          req.app.get("io")?.emit("document:created", doc);
          res.json({ message: "Upload successful", doc });
        });
      }
    });
  });

  busboy.on("error", () =>
    res.status(500).json({ message: "Upload failed" })
  );

  req.pipe(busboy);
};

/**
 * Update existing document
 */
const updateDocument = (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  Document.findById(req.params.id).then((doc) => {
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE },
    });

    let newName = null;
    let totalSize = 0;
    const chunks = [];

    busboy.on("field", (name, value) => {
      if (name === "originalName") newName = value;
    });

    busboy.on("file", (fieldname, file, info) => {
      if (info.mimeType !== "application/pdf") {
        file.resume();
        return res.status(400).json({ message: "Only PDF allowed" });
      }

      file.on("data", (chunk) => {
        totalSize += chunk.length;

        if (totalSize > MAX_FILE_SIZE) {
          file.resume();
          return res.status(413).json({ message: "File exceeds 500MB limit" });
        }

        if (totalSize <= CLOUDINARY_LIMIT) {
          chunks.push(chunk);
        }
      });

      file.on("end", async () => {
        // Remove old file
        if (doc.storage === "local" && fs.existsSync(doc.path)) {
          fs.unlinkSync(doc.path);
        }
        if (doc.storage === "cloudinary") {
          await cloudinary.uploader.destroy(doc.filename, { resource_type: "raw" });
        }

        // ---------- SMALL → CLOUDINARY ----------
        if (totalSize <= CLOUDINARY_LIMIT) {
          const buffer = Buffer.concat(chunks);

          const stream = cloudinary.uploader.upload_stream(
            { resource_type: "raw", folder: "documents" },
            async (err, result) => {
              if (err) return res.status(500).json({ message: "Cloudinary upload failed" });

              doc.filename = result.public_id;
              doc.cloudUrl = result.secure_url;
              doc.storage = "cloudinary";
              doc.size = totalSize;
              if (newName) doc.originalName = newName;

              await doc.save();
              req.app.get("io")?.emit("document:updated", doc);
              res.json({ message: "Document updated", doc });
            }
          );

          stream.end(buffer);
        }

        // ---------- LARGE → LOCAL ----------
        else {
          const localName = `${Date.now()}-${Math.random().toString(36)}.pdf`;
          const localPath = path.join(UPLOAD_DIR, localName);

          const writeStream = fs.createWriteStream(localPath);
          file.pipe(writeStream);

          writeStream.on("finish", async () => {
            doc.filename = localName;
            doc.path = localPath;
            doc.storage = "local";
            doc.size = totalSize;
            doc.cloudUrl = `${process.env.BACKEND_URL}/documents/file/${localName}`;
            if (newName) doc.originalName = newName;

            await doc.save();
            req.app.get("io")?.emit("document:updated", doc);
            res.json({ message: "Document updated", doc });
          });
        }
      });
    });

    req.pipe(busboy);
  });
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
