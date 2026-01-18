import express from "express";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { auth } from "../middleware/auth.js";
import crypto from "crypto";
import { sendInvitationEmail } from "../utils/resend.js";
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

  const invitation = await Invitation.create({
    email,
    role,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const inviteLink = `${process.env.FRONTEND_URL}/#/accept-invite/${token}`;
  await sendInvitationEmail(email, inviteLink);



  // 🔴 SOCKET EVENT
  req.app.get("io").emit("user:invited", {
    email,
    role,
  });

  res.json({
    message: "Invitation sent",
    inviteLink,
    previewUrl: inviteLink,
  });
});

/**
 * PATCH update user
 */
router.patch("/:id", auth, async (req, res) => {
  try {
    const currentUserRole = req.user.role;
    const targetUserId = req.params.id;

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // RBAC
    if (currentUserRole === "VIEWER") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (currentUserRole === "ADMIN") {
      if (targetUser.role !== "VIEWER") {
        return res.status(403).json({ message: "Admins can edit Viewers only" });
      }
      if (req.body.role && req.body.role !== "VIEWER") {
        return res.status(403).json({ message: "Admins cannot change roles" });
      }
    }

    if (
      currentUserRole === "OWNER" &&
      targetUser.role === "OWNER" &&
      targetUser._id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Owners cannot edit other Owners" });
    }

    // Allowed fields
    const allowedUpdates = ["name", "role"];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        targetUser[field] = req.body[field];
      }
    });

    if (!targetUser.name) {
      targetUser.name = getNameFromEmail(targetUser.email);
    }

    await targetUser.save();

    // 🔴 SOCKET EVENT
    req.app.get("io").emit("user:updated", {
      _id: targetUser._id,
      name: targetUser.name,
      role: targetUser.role,
    });

    res.json({
      message: "User updated successfully",
      user: targetUser,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE user
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const { role } = req.user;

    if (role === "VIEWER") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (role === "ADMIN" && targetUser.role !== "VIEWER") {
      return res
        .status(403)
        .json({ message: "Admins can delete Viewers only" });
    }

    if (role === "OWNER" && targetUser.role === "OWNER") {
      return res
        .status(403)
        .json({ message: "Owners cannot delete other Owners" });
    }

    await targetUser.deleteOne();

    // 🔴 SOCKET EVENT
    req.app.get("io").emit("user:deleted", targetUser._id);

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
