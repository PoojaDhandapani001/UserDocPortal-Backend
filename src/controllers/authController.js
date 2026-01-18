import AuthService from "../services/authService.js";

const AuthController = {
  login: async (req, res) => {
    try {
      const token = await AuthService.login(req.body.email, req.body.password);
      res.json({ token });
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },

  acceptInvite: async (req, res) => {
    try {
      const result = await AuthService.acceptInvite(req.params.token, req.body.password, req.io);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },
};

export default AuthController;
