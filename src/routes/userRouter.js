import express from "express";
import UserController from "../controllers/userController.js";
import { auth } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

const router = express.Router();

// LIST USERS (only Owner & Admin should see users)
router.get(
  "/",
  auth,
  authorize("VIEW_USERS"),
  UserController.getAllUsers
);

// INVITE USER
router.post(
  "/invite",
  auth,
  (req, res, next) => {
    // Owner can invite both Admin & Viewer
    if (req.user.role === "OWNER") return authorize("INVITE_ADMIN")(req, res, next);
    // Admin can only invite Viewer
    return authorize("INVITE_VIEWER")(req, res, next);
  },
  UserController.inviteUser
);

// UPDATE USER
router.patch(
  "/:id",
  auth,
  (req, res, next) => {
    // Owner can edit any role
    if (req.user.role === "OWNER") return authorize("USER_EDIT")(req, res, next);
    // Admin can only edit Viewers
    return authorize("USER_EDIT_VIEWER")(req, res, next);
  },
  UserController.updateUser
);

// DELETE USER
router.delete(
  "/:id",
  auth,
  (req, res, next) => {
    // Owner can delete any role
    if (req.user.role === "OWNER") return authorize("USER_DELETE")(req, res, next);
    // Admin can only delete Viewers
    return authorize("USER_DELETE_VIEWER")(req, res, next);
  },
  UserController.deleteUser
);

export default router;
