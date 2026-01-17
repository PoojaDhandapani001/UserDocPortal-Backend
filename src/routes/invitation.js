import express from "express";
import crypto from "crypto";
import Invitation from "../models/Invitation.js";
import { auth } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

const router = express.Router();

// GET all pending invitations (OWNER/ADMIN only)
router.get("/", auth, async (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const status = req.query.status
      ? req.query.status.toUpperCase()
      : "PENDING";

    const invitations = await Invitation.find({ status }).select("-token");
    res.json(invitations);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invitations" });
  }
});

router.post("/invite", auth, authorize("INVITE_VIEWER"), async (req, res) => {
  const { email, role } = req.body;

  const token = crypto.randomBytes(32).toString("hex");

  const invitation = await Invitation.create({
    email,
    role,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const io = req.app.get("io");

  io.to("admins").emit("user-updated", {
    action: "invited",
    email: invite.email,
    role: invite.role,
  });

  res.json({
    message: "Invitation sent",
    inviteLink: `http://localhost:3000/accept-invite/${token}`,
  });
});

// POST /users/revoke/:id  (OWNER/ADMIN only)
router.post("/revoke/:id", auth, async (req, res) => {
  const invitationId = req.params.id;

  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const invitation = await Invitation.findById(invitationId);
  if (!invitation) {
    return res.status(404).json({ message: "Invitation not found" });
  }

  // Only PENDING invitations can be revoked
  if (invitation.status !== "PENDING") {
    return res.status(400).json({ message: "Cannot revoke this invitation" });
  }

  invitation.status = "EXPIRED";
  await invitation.save();

  // Optionally, emit socket event to refresh frontend lists
  req.app.get("io").to("admins").emit("invitation-updated", invitation);

  res.json({ message: "Invitation revoked", invitation });
});

export default router;
