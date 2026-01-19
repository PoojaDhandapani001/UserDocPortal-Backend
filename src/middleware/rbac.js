// middleware/permissions.js or wherever this is defined

export const permissions = {
  OWNER: [
    "INVITE_ADMIN",
    "INVITE_VIEWER",
    "USER_EDIT",
    "USER_DELETE",
    "UPLOAD_DOCUMENT",
    "VIEW_INVITATIONS",
    "VIEW_USERS"
  ],
  ADMIN: [
    "INVITE_VIEWER",   // can invite viewer only
    "USER_EDIT_VIEWER",
    "USER_DELETE_VIEWER",
    "UPLOAD_DOCUMENT",
    "VIEW_INVITATIONS",
    "VIEW_USERS"
  ],
  VIEWER: [
    "VIEW_DOCUMENT"
    // no access to users or invitations
  ],
};

export const authorize = (permission) => (req, res, next) => {
  const role = req.user.role;
  if (!permissions[role]?.includes(permission)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};
