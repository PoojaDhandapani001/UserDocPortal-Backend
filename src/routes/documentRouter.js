import express from "express";
import { auth } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import DocumentController from "../controllers/documentController.js";

const router = express.Router();

// ----------------------------------
// Public / Authenticated Routes
// ----------------------------------

// list documents — any authenticated user with VIEW_DOCUMENT
router.get(
  "/",
  auth,
  authorize("VIEW_DOCUMENT"),
  DocumentController.listDocuments
);

// view document details
router.get(
  "/:id/view",
  auth,
  authorize("VIEW_DOCUMENT"),
  DocumentController.viewDocument
);

// serve local file — this is a public route in your previous version
router.get("/file/:filename", DocumentController.serveLocalFile);

// ----------------------------------
// Protected Routes
// ----------------------------------

// upload new document (OWNER & ADMIN per permissions)
router.post(
  "/upload",
  auth,
  authorize("UPLOAD_DOCUMENT"),
  DocumentController.uploadDocument
);

// update existing document
router.patch(
  "/:id",
  auth,
  authorize("UPLOAD_DOCUMENT"),
  DocumentController.updateDocument
);

// delete document
router.delete(
  "/:id",
  auth,
  authorize("UPLOAD_DOCUMENT"),
  DocumentController.deleteDocument
);

export default router;
