import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import crypto from "crypto";
import { sendInvitationEmail } from "../utils/resend.js";
import { getNameFromEmail } from "../utils/utilities.js";

const UserService = {
  getAllUsers: async (currentUser) => {
    if (currentUser.role === "VIEWER") throw { status: 403, message: "Access denied" };
    return User.find().select("-password");
  },

  inviteUser: async (currentUser, { email, role }, io) => {
    // RBAC
    if (!["OWNER", "ADMIN"].includes(currentUser.role)) throw { status: 403, message: "Access denied" };
    if (currentUser.role === "ADMIN" && role !== "VIEWER") throw { status: 403, message: "Admins can invite Viewers only" };
    if (!email || !role) throw { status: 400, message: "Email and role required" };

    const existingUser = await User.findOne({ email });
    if (existingUser) throw { status: 400, message: "User already exists" };

    // Expire old invites
    await Invitation.updateMany({ email, status: "PENDING" }, { status: "EXPIRED" });

    const token = crypto.randomBytes(32).toString("hex");
    const invitation = await Invitation.create({
      email,
      role,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const inviteLink = `${process.env.FRONTEND_URL}/#/accept-invite/${token}`;
    await sendInvitationEmail(email, inviteLink);

    // Socket event
    io?.emit("user:invited", { email, role });

    return { message: "Invitation sent", inviteLink, previewUrl: inviteLink };
  },

  updateUser: async (currentUser, targetUserId, updates, io) => {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw { status: 404, message: "User not found" };

    // RBAC
    if (currentUser.role === "VIEWER") throw { status: 403, message: "Forbidden" };
    if (currentUser.role === "ADMIN") {
      if (targetUser.role !== "VIEWER") throw { status: 403, message: "Admins can edit Viewers only" };
      if (updates.role && updates.role !== "VIEWER") throw { status: 403, message: "Admins cannot change roles" };
    }
    if (currentUser.role === "OWNER" && targetUser.role === "OWNER" && targetUser._id.toString() !== currentUser._id.toString()) {
      throw { status: 403, message: "Owners cannot edit other Owners" };
    }

    // Apply allowed updates
    const allowedFields = ["name", "role"];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) targetUser[field] = updates[field];
    });

    if (!targetUser.name) targetUser.name = getNameFromEmail(targetUser.email);

    await targetUser.save();

    io?.emit("user:updated", { _id: targetUser._id, name: targetUser.name, email: targetUser.email, role: targetUser.role });

    return targetUser;
  },

  deleteUser: async (currentUser, targetUserId, io) => {
    if (currentUser.role === "VIEWER") throw { status: 403, message: "Forbidden" };

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw { status: 404, message: "User not found" };

    if (currentUser.role === "ADMIN" && targetUser.role !== "VIEWER") throw { status: 403, message: "Admins can delete Viewers only" };
    if (currentUser.role === "OWNER" && targetUser.role === "OWNER") throw { status: 403, message: "Owners cannot delete other Owners" };

    await targetUser.deleteOne();

    io?.emit("user:deleted", targetUser._id);
  },
};

export default UserService;
