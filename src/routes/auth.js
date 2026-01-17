import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { getNameFromEmail } from "../utils/utilities.js";

const router = express.Router();

/**
 * POST /login
 * Logs in a user and returns a JWT token.
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("LOGIN ATTEMPT:", email, password);

  const user = await User.findOne({ email });
  console.log("USER FROM DB:", user);

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  console.log("HASH FROM DB:", user.password);

  const match = await bcrypt.compare(password, user.password);
  console.log("BCRYPT MATCH RESULT:", match);

  if (!match) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token });
});

/**
 * POST /accept-invite/:token
 * Accepts an invitation, creates a new user,
 * and emits a live "user:joined" event via Socket.IO.
 */
router.post("/accept-invite/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    // Find invite
    const invite = await Invitation.findOne({ token });

    if (!invite) {
      return res.status(400).json({ message: "Invalid invitation link" });
    }

    if (invite.status !== "PENDING") {
      return res.status(400).json({ message: "Invitation already used" });
    }

    if (invite.expiresAt < new Date()) {
      invite.status = "EXPIRED";
      await invite.save();
      return res.status(400).json({ message: "Invitation expired" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({
      name: getNameFromEmail(invite.email),
      email: invite.email,
      password: hashed,
      role: invite.role,
      status: "ACTIVE",
    });

    // Mark invite as accepted
    invite.status = "ACCEPTED";
    await invite.save();

    // 🔴 Emit live event to all connected clients
    if (req.io) {
      req.io.emit("user:joined", {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      });
    }

    res.json({ message: "Account created successfully", user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    }});
  } catch (err) {
    console.error("Error accepting invite:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
