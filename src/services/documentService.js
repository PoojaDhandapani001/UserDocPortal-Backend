import fs from "fs";
import path from "path";
import Document from "../models/Document.js";
import cloudinary from "../utils/cloudinary.js";
import { uploadDocument as uploadUtil, updateDocument as updateUtil, UPLOAD_DIR } from "../utils/utilities.js";
import dotenv from "dotenv";
dotenv.config();

const DocumentService = {
  listDocuments: async () => {
    const docs = await Document.find().sort({ createdAt: -1 }).lean();
    return docs.map((doc) => ({
      ...doc,
      url:
        doc.storage === "cloudinary"
          ? doc.url
          : `${process.env.BACKEND_URL}/documents/file/${doc.filename}`,
    }));
  },

  viewDocument: async (id, res) => {
    const doc = await Document.findById(id);
    if (!doc) throw { status: 404, message: "Document not found" };

    if (doc.storage === "cloudinary") return res.redirect(doc.url);

    const filePath = path.join(UPLOAD_DIR, doc.filename);
    if (!fs.existsSync(filePath)) throw { status: 404, message: "File not found" };

    res.sendFile(filePath);
  },

  serveLocalFile: async (filename, res) => {
    if (filename.includes("..") || filename.includes("/")) throw { status: 400, message: "Invalid filename" };

    const filePath = path.resolve(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) throw { status: 404, message: "File not found" };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.sendFile(filePath, (err) => {
      if (err) throw err;
    });
  },

  uploadDocument: async (req, res) => {
    await uploadUtil(req, res);
  },

  updateDocument: async (id, body, req, res) => {
    await updateUtil(id, body, req, res);
  },

  deleteDocument: async (id, user, io) => {
    const doc = await Document.findById(id);
    if (!doc) throw { status: 404, message: "Document not found" };

    if (doc.storage === "cloudinary" && doc.filename) {
      await cloudinary.uploader.destroy(doc.filename, { resource_type: "raw" });
    }

    if (doc.storage === "local" && doc.path && fs.existsSync(doc.path)) {
      fs.unlinkSync(doc.path);
    }

    await doc.deleteOne();
    io?.emit("document:deleted", doc._id.toString());
  },
};

export default DocumentService;
