import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { getNameFromEmail } from "../utils/utilities.js";

const AuthService = {
  login: async (email, password) => {
    const user = await User.findOne({ email });
    if (!user) throw { status: 400, message: "Invalid credentials" };

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw { status: 400, message: "Invalid credentials" };

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return token;
  },

  acceptInvite: async (token, password, io) => {
    const invite = await Invitation.findOne({ token });
    if (!invite) throw { status: 400, message: "Invalid invitation link" };
    if (invite.status !== "PENDING") throw { status: 400, message: "Invitation already used" };
    if (invite.expiresAt < new Date()) {
      invite.status = "EXPIRED";
      await invite.save();
      throw { status: 400, message: "Invitation expired" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: getNameFromEmail(invite.email),
      email: invite.email,
      password: hashedPassword,
      role: invite.role,
      status: "ACTIVE",
    });

    invite.status = "ACCEPTED";
    await invite.save();

    // Emit live event
    io?.emit("user:joined", {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });

    return {
      message: "Account created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  },
};

export default AuthService;
