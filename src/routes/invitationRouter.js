import express from "express";
import InvitationController from "../controllers/invitationController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth, InvitationController.listInvitations);
router.post("/invite", auth, InvitationController.sendInvite);
router.post("/revoke/:id", auth, InvitationController.revokeInvite);

export default router;
