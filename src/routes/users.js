import express from "express";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { auth } from "../middleware/auth.js";
import crypto from "crypto";
import { sendInvitationEmail } from "../utils/mailer.js";
import nodemailer from "nodemailer";
import { getNameFromEmail } from "../utils/utilities.js";

const router = express.Router();

/**
 * GET all users (OWNER / ADMIN only)
 */
router.get("/", auth, async (req, res) => {
  if (req.user.role === "VIEWER") {
    return res.status(403).json({ message: "Access denied" });
  }

  const users = await User.find().select("-password");
  res.json(users);
});

/**
 * POST invite a new user
 * OWNER → ADMIN / VIEWER
 * ADMIN → VIEWER only
 */
// Invite user (OWNER / ADMIN)
router.post("/invite", auth, async (req, res) => {
  const { email, role } = req.body;

  if (!["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  if (req.user.role === "ADMIN" && role !== "VIEWER") {
    return res.status(403).json({ message: "Admins can invite Viewers only" });
  }

  if (!email || !role) {
    return res.status(400).json({ message: "Email and role required" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  // Expire old invites
  await Invitation.updateMany(
    { email, status: "PENDING" },
    { status: "EXPIRED" }
  );

  const token = crypto.randomBytes(32).toString("hex");

  await Invitation.create({
    email,
    role,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const inviteLink = `http://localhost:5173/accept-invite/${token}`;
  await sendInvitationEmail(email, inviteLink);

  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: process.env.ETHEREAL_USER,
      pass: process.env.ETHEREAL_PASS,
    },
  });

  const mailOptions = {
    from: `"User Portal" <${process.env.ETHEREAL_USER}>`,
    to: email,
    subject: "You are invited!",
    text: `Click the link to accept invitation: ${inviteLink}`,
    html: `<p>Click the link to accept invitation: <a href="${inviteLink}">${inviteLink}</a></p>`,
  };

  const info = await transporter.sendMail(mailOptions);

  res.json({
    message: "Invitation sent",
    inviteLink,
    previewUrl: nodemailer.getTestMessageUrl(info), // THIS IS THE ETHEREAL PREVIEW URL
  });
  // res.json({ message: "Invitation created", inviteLink });
});

router.patch("/:id", auth, async (req, res) => {
  try {
    const currentUserRole = req.user.role; // logged-in user's role
    const targetUserId = req.params.id;

    // Fetch target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // --------------------------
    // ROLE PERMISSIONS CHECKS
    // --------------------------

    // Viewers cannot edit anyone
    if (currentUserRole === "VIEWER") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Admins can only edit viewers
    if (currentUserRole === "ADMIN") {
      if (targetUser.role !== "VIEWER") {
        return res.status(403).json({ message: "Admins can edit Viewers only" });
      }
      if (req.body.role && req.body.role !== "VIEWER") {
        return res
          .status(403)
          .json({ message: "Admins cannot change user roles" });
      }
    }

    // Owners cannot edit other owners
    if (currentUserRole === "OWNER" && targetUser.role === "OWNER" && targetUser._id.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Owners cannot edit other Owners" });
    }

    // --------------------------
    // APPLY ALLOWED UPDATES
    // --------------------------
    const allowedUpdates = ["name", "role"];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        targetUser[field] = req.body[field];
      }
    });

    // Auto-generate name if missing
    if (!targetUser.name) {
      targetUser.name = getNameFromEmail(targetUser.email);
    }

    // Save changes
    await targetUser.save();

    res.json({ message: "User updated successfully", user: targetUser });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const { role, id: requesterId } = req.user;

    // Viewers can never delete users
    if (role === "VIEWER") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Admins → Viewers only
    if (role === "ADMIN" && targetUser.role !== "VIEWER") {
      return res
        .status(403)
        .json({ message: "Admins can delete Viewers only" });
    }

    // Owners → Admins + Viewers (cannot delete Owner)
    if (role === "OWNER" && targetUser.role === "OWNER") {
      return res
        .status(403)
        .json({ message: "Owners cannot delete other Owners" });
    }

    await targetUser.deleteOne();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
