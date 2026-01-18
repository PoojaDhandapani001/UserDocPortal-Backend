import DocumentService from "../services/documentService.js";

const DocumentController = {
  listDocuments: async (req, res) => {
    try {
      const docs = await DocumentService.listDocuments();
      res.json(docs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to list documents" });
    }
  },

  viewDocument: async (req, res) => {
    try {
      await DocumentService.viewDocument(req.params.id, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to view document" });
    }
  },

  serveLocalFile: async (req, res) => {
    try {
      await DocumentService.serveLocalFile(req.params.filename, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to serve file" });
    }
  },

  uploadDocument: async (req, res) => {
    try {
      await DocumentService.uploadDocument(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Upload failed" });
    }
  },

  updateDocument: async (req, res) => {
    try {
      await DocumentService.updateDocument(req.params.id, req.body, req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Update failed" });
    }
  },

  deleteDocument: async (req, res) => {
    try {
      await DocumentService.deleteDocument(req.params.id, req.user, req.app.get("io"));
      res.json({ message: "Deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Delete failed" });
    }
  },
};

export default DocumentController;
