import express from "express";
import InvitationController from "../controllers/invitationController.js";
import { auth } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

const router = express.Router();

// Owner + Admin can *view* pending invitations
router.get(
  "/",
  auth,
  authorize("VIEW_INVITATIONS"),
  InvitationController.listInvitations
);

// Owner + Admin can view invitation details
router.get(
  "/:id",
  auth,
  authorize("VIEW_INVITATIONS"),
  InvitationController.getInvitationById
);

// Invite endpoint:
// - Owner needs INVITE_ADMIN if inviting admin
// - Admin only has INVITE_VIEWER (so can invite viewer but NOT admin)
router.post(
  "/invite",
  auth,
  (req, res, next) => {
    // decide based on user role
    if (req.user.role === "OWNER") {
      return authorize("INVITE_ADMIN")(req, res, next);
    }
    // Admin falls back to invite viewer only
    return authorize("INVITE_VIEWER")(req, res, next);
  },
  InvitationController.sendInvite
);

// revoke invitation: both Owner and Admin can revoke
router.post(
  "/revoke/:id",
  auth,
  authorize("INVITE_VIEWER"), // both OWNER and ADMIN include this
  InvitationController.revokeInvite
);

export default router;
