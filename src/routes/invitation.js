import express from "express";
import crypto from "crypto";
import Invitation from "../models/Invitation.js";
import { auth } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

const router = express.Router();

/**
 * GET /invitations?status=PENDING
 * Fetch all invitations filtered by status (default: PENDING)
 * Only OWNER/ADMIN can access
 */
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
    console.error("Failed to fetch invitations:", err);
    res.status(500).json({ message: "Failed to fetch invitations" });
  }
});

/**
 * POST /invitations/invite
 * Create a new invitation (OWNER/ADMIN)
 * Emits a live socket event to "admins" room
 */
router.post("/invite", auth, authorize("INVITE_VIEWER"), async (req, res) => {
  try {
    const { email, role } = req.body;

    // --- Prevent duplicate pending invitations ---
    const existingInvite = await Invitation.findOne({
      email,
      status: "PENDING",
    });
    if (existingInvite) {
      return res
        .status(400)
        .json({ message: "There is already a pending invitation for this email" });
    }


    const token = crypto.randomBytes(32).toString("hex");

    const invitation = await Invitation.create({
      email,
      role,
      token,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // --- Emit socket event immediately after creation ---
    const io = req.app.get("io");
    if (io) {
      io.emit("invitation-updated", {
        action: "invited",
        invitation: {
          _id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
      });
    }

    res.json({
      message: "Invitation sent",
      inviteLink: `${process.env.FRONTEND_URL_PROD}/accept-invite/${token}`,
      invitation,
    });
  } catch (err) {
    console.error("Failed to create invitation:", err);
    res.status(500).json({ message: "Failed to send invitation" });
  }
});


/**
 * POST /invitations/revoke/:id
 * Revoke a pending invitation (OWNER/ADMIN)
 * Emits live socket event to refresh frontend lists
 */
router.post("/revoke/:id", auth, async (req, res) => {
  const invitationId = req.params.id;

  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.status !== "PENDING") {
      return res.status(400).json({ message: "Cannot revoke this invitation" });
    }

    invitation.status = "EXPIRED";
    await invitation.save();

    // Emit live update
    const io = req.app.get("io");
    if (io) {
      io.to("admins").emit("invitation-updated", {
        action: "revoked",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
      });
    }

    res.json({ message: "Invitation revoked", invitation });
  } catch (err) {
    console.error("Failed to revoke invitation:", err);
    res.status(500).json({ message: "Failed to revoke invitation" });
  }
});

export default router;
