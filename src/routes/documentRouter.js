import express from "express";
import { auth } from "../middleware/auth.js";
import DocumentController from "../controllers/documentController.js";

const router = express.Router();

router.get("/", auth, DocumentController.listDocuments);
router.get("/:id/view", auth, DocumentController.viewDocument);
router.get("/file/:filename", DocumentController.serveLocalFile);

router.post("/upload", auth, DocumentController.uploadDocument);
router.patch("/:id", auth, DocumentController.updateDocument);
router.delete("/:id", auth, DocumentController.deleteDocument);

export default router;
