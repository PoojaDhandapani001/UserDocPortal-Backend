import express from "express";
import crypto from "crypto";
import Invitation from "../models/Invitation.js";
import { auth } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { sendInvitationEmail } from "../utils/resend.js";

const router = express.Router();

/**
 * GET /invitations?status=PENDING
 * OWNER / ADMIN only
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
 * OWNER / ADMIN
 */
router.post("/invite", auth, authorize("INVITE_VIEWER"), async (req, res) => {
  try {
    const { email, role } = req.body;

    // Prevent duplicate pending invite
    const existingInvite = await Invitation.findOne({
      email,
      status: "PENDING",
    });

    if (existingInvite) {
      return res
        .status(400)
        .json({ message: "Pending invitation already exists" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const invitation = await Invitation.create({
      email,
      role,
      token,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite/${token}`;

    // ✅ Send email (Resend – fast & prod-safe)
    await sendInvitationEmail(email, inviteLink);

    // ✅ Emit socket event
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

    // ✅ Preview link restored (safe)
    res.json({
      message: "Invitation sent",
      inviteLink, // show to admin
      previewUrl: inviteLink,
    });
  } catch (err) {
    console.error("Failed to send invitation:", err);
    res.status(500).json({ message: "Failed to send invitation" });
  }
});

/**
 * POST /invitations/revoke/:id
 * OWNER / ADMIN
 */
router.post("/revoke/:id", auth, async (req, res) => {
  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const invitation = await Invitation.findById(req.params.id);
    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.status !== "PENDING") {
      return res.status(400).json({ message: "Cannot revoke this invitation" });
    }

    invitation.status = "EXPIRED";
    await invitation.save();

    // ✅ Emit socket update
    const io = req.app.get("io");
    if (io) {
      io.emit("invitation-updated", {
        action: "revoked",
        invitation: {
          _id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
      });
    }

    res.json({ message: "Invitation revoked" });
  } catch (err) {
    console.error("Failed to revoke invitation:", err);
    res.status(500).json({ message: "Failed to revoke invitation" });
  }
});

export default router;
