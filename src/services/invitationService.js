import crypto from "crypto";
import Invitation from "../models/Invitation.js";
import User from "../models/User.js";
import { sendInvitationEmail } from "../utils/resend.js";
import { isValidEmail } from "../utils/utilities.js";

const InvitationService = {
    listInvitations: async (currentUser, statusQuery) => {
        if (!["OWNER", "ADMIN"].includes(currentUser.role)) {
            throw { status: 403, message: "Access denied" };
        }

        const status = statusQuery ? statusQuery.toUpperCase() : "PENDING";
        return Invitation.find({ status }).select("-token");
    },

    sendInvite: async (currentUser, { email, role }, io) => {
        // 1️⃣ Permission check
        if (!["OWNER", "ADMIN"].includes(currentUser.role)) {
            throw { status: 403, message: "Access denied" };
        }

        // 2️⃣ Validate email format
        if (!isValidEmail(email)) {
            throw { status: 400, message: "Invalid email format" };
        }

        // 3️⃣ Prevent duplicate pending invitations
        const existingInvite = await Invitation.findOne({ email, status: "PENDING" });
        if (existingInvite) throw { status: 400, message: "Pending invitation already exists" };

        // 4️⃣ Prevent inviting an existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) throw { status: 400, message: "User with this email already exists" };

        // 5️⃣ Generate token and invite link
        const token = crypto.randomBytes(32).toString("hex");
        const inviteLink = `${process.env.FRONTEND_URL}/#/accept-invite/${token}`;

        // 6️⃣ Send email
        await sendInvitationEmail(email, inviteLink);

        // 7️⃣ Create invitation
        const invitation = await Invitation.create({
            email,
            role,
            previewUrl: inviteLink,
            token,
            status: "PENDING",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        // 8️⃣ Emit socket event
        io?.emit("invitation-updated", {
            action: "invited",
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                previewUrl: invitation.previewUrl,
                role: invitation.role,
                status: invitation.status,
                expiresAt: invitation.expiresAt,
            },
        });

        return { message: "Invitation sent", inviteLink, previewUrl: inviteLink };
    },

    revokeInvite: async (currentUser, invitationId, io) => {
        if (!["OWNER", "ADMIN"].includes(currentUser.role)) {
            throw { status: 403, message: "Access denied" };
        }

        const invitation = await Invitation.findById(invitationId);

        if (!invitation || invitation.status !== "PENDING") {
            // Emit latest users and pending invitations before throwing
            const [allUsers, pendingInvites] = await Promise.all([
                User.find().select("_id name email role"),
                Invitation.find({ status: "PENDING" }),
            ]);

            io?.emit("recent-user-joins", allUsers);
            io?.emit("invitation-updated-list", pendingInvites);

            throw { status: 404, message: "Invitation not found" };
        }

        //   if (invitation.status !== "PENDING") {
        //     throw { status: 400, message: "Cannot revoke this invitation" };
        //   }

        invitation.status = "EXPIRED";
        await invitation.save();

        io?.emit("invitation-updated", {
            action: "revoked",
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                previewUrl: invitation.previewUrl,
                role: invitation.role,
                status: invitation.status,
                expiresAt: invitation.expiresAt,
            },
        });
    },
    getInvitationById: async (currentUser, invitationId, io) => {
        try {
            const invitation = await Invitation.findById(invitationId);
            const pendingInvites = await Invitation.find({ status: "PENDING" });
            io?.emit("invitation-updated-list", pendingInvites);
            if (!invitation || invitation.status !== "PENDING") throw { status: 404, message: "Invitation not found" };
            return invitation;
        } catch (err) {
            throw { status: 500, message: err.message };
        }
    }
};

export default InvitationService;
