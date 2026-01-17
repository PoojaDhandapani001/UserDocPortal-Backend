import express from "express";
import bcrypt from "bcrypt";
import Invitation from "../models/Invitation.js";
import User from "../models/User.js";
import { getNameFromEmail } from "../utils/utilities.js";

const router = express.Router();

router.post("/accept-invite/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const invite = await Invitation.findOne({ token, used: false });

  if (!invite) {
    return res.status(400).json({ message: "Invalid or used invite" });
  }

  if (invite.expiresAt < new Date()) {
    return res.status(400).json({ message: "Invite expired" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await User.create({
    name: getNameFromEmail(invite.email),
    email: invite.email,
    password: hashedPassword,
    role: invite.role,
    status: "ACTIVE"
  });

  invite.used = true;
  await invite.save();

  res.json({ message: "Account activated" });
});

export default router;
