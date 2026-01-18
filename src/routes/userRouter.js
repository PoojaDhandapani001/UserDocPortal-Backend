import express from "express";
import UserController from "../controllers/userController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth, UserController.getAllUsers);
router.post("/invite", auth, UserController.inviteUser);
router.patch("/:id", auth, UserController.updateUser);
router.delete("/:id", auth, UserController.deleteUser);

export default router;
