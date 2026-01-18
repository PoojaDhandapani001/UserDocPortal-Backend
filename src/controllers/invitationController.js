import InvitationService from "../services/invitationService.js";

const InvitationController = {
  listInvitations: async (req, res) => {
    try {
      const invitations = await InvitationService.listInvitations(req.user, req.query.status);
      res.json(invitations);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },

  sendInvite: async (req, res) => {
    try {
      const result = await InvitationService.sendInvite(req.user, req.body, req.app.get("io"));
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },

  revokeInvite: async (req, res) => {
    try {
      await InvitationService.revokeInvite(req.user, req.params.id, req.app.get("io"));
      res.json({ message: "Invitation revoked" });
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },
};

export default InvitationController;
