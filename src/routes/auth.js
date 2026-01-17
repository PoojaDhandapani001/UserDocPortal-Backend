import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { getNameFromEmail } from "../utils/utilities.js";



const router = express.Router();

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

router.post("/accept-invite/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

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

  const hashed = await bcrypt.hash(password, 10);

  await User.create({
    name: getNameFromEmail(invite.email),
    email: invite.email,
    password: hashed,
    role: invite.role,
    status: "ACTIVE",
  });

  invite.status = "ACCEPTED";
  await invite.save();

  res.json({ message: "Account created successfully" });
});

export default router;

// {
//   "email": "owner@test.com",
//   "password": "password123"
// }
// {
//   "email": "viewer@test.com",
//   "password": "viewer123"
// }



