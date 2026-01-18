import crypto from "crypto";
import Invitation from "../models/Invitation.js";
import { sendInvitationEmail } from "../utils/resend.js";

const InvitationService = {
    listInvitations: async (currentUser, statusQuery) => {
        if (!["OWNER", "ADMIN"].includes(currentUser.role)) {
            throw { status: 403, message: "Access denied" };
        }

        const status = statusQuery ? statusQuery.toUpperCase() : "PENDING";
        return Invitation.find({ status }).select("-token");
    },

    sendInvite: async (currentUser, { email, role }, io) => {
        if (!["OWNER", "ADMIN"].includes(currentUser.role)) {
            throw { status: 403, message: "Access denied" };
        }

        // Prevent duplicate pending invites
        const existingInvite = await Invitation.findOne({ email, status: "PENDING" });
        if (existingInvite) throw { status: 400, message: "Pending invitation already exists" };

        const token = crypto.randomBytes(32).toString("hex");



        const inviteLink = `${process.env.FRONTEND_URL}/#/accept-invite/${token}`;
        await sendInvitationEmail(email, inviteLink);
        const invitation = await Invitation.create({
            email,
            role,
            previewUrl: inviteLink,
            token,
            status: "PENDING",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        // Emit socket event
        io?.emit("invitation-updated", {
            action: "invited",
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                previewUrl: invitation.inviteLink,
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
        if (!invitation) throw { status: 404, message: "Invitation not found" };
        if (invitation.status !== "PENDING") throw { status: 400, message: "Cannot revoke this invitation" };

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
};

export default InvitationService;
