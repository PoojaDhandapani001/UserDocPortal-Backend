import express from "express";
import AuthController from "../controllers/authController.js";

const router = express.Router();

router.post("/login", AuthController.login);
router.post("/accept-invite/:token", AuthController.acceptInvite);

export default router;
