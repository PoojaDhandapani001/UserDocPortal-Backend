import UserService from "../services/userService.js";

const UserController = {
  getAllUsers: async (req, res) => {
    try {
      const users = await UserService.getAllUsers(req.user);
      res.json(users);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },

  inviteUser: async (req, res) => {
    try {
      const result = await UserService.inviteUser(req.user, req.body, req.app.get("io"));
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },

  updateUser: async (req, res) => {
    try {
      const updatedUser = await UserService.updateUser(req.user, req.params.id, req.body, req.app.get("io"));
      res.json({ message: "User updated successfully", user: updatedUser });
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },

  deleteUser: async (req, res) => {
    try {
      await UserService.deleteUser(req.user, req.params.id, req.app.get("io"));
      res.status(204).send();
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },
};

export default UserController;
