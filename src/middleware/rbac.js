const permissions = {
  OWNER: [
    "INVITE_ADMIN",
    "INVITE_VIEWER",
    "MANAGE_USERS",
    "UPLOAD_DOCUMENT"
  ],
  ADMIN: [
    "INVITE_VIEWER",
    "UPLOAD_DOCUMENT"
  ],
  VIEWER: ["VIEW_DOCUMENT"]
};

export const authorize = (permission) => {
  return (req, res, next) => {
    const role = req.user.role;
    if (!permissions[role]?.includes(permission)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
