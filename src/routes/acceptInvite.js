import express from "express";
import bcrypt from "bcrypt";
import Invitation from "../models/Invitation.js";
import User from "../models/User.js";
import { getNameFromEmail } from "../utils/utilities.js";

const router = express.Router();

/**
 * POST /accept-invite/:token
 * Accepts an invite and creates a new user.
 * Emits a live "user:joined" event to all connected clients via Socket.IO.
 */
router.post("/accept-invite/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    // Find invite
    const invite = await Invitation.findOne({ token, used: false });

    if (!invite) {
      return res.status(400).json({ message: "Invalid or used invite" });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invite expired" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({
      name: getNameFromEmail(invite.email),
      email: invite.email,
      password: hashedPassword,
      role: invite.role,
      status: "ACTIVE",
    });

    // Mark invite as used
    invite.used = true;
    await invite.save();

    // 🔴 Emit live event to all connected clients
    // Make sure your server passes `io` via `req.io` middleware
    if (req.io) {
      req.io.emit("user:joined", {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      });
    }

    res.json({ message: "Account activated", user: { id: newUser._id, name: newUser.name, email: newUser.email } });
  } catch (err) {
    console.error("Error accepting invite:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
