import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "node:dns";
import User from "./models/User.js";

dotenv.config();

// Force DNS (ok to keep)
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();
const server = http.createServer(app);

/* =======================
   CORS (REST API)
======================= */
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL
    ],
    credentials: true
  })
);


app.use(express.json());

/* =======================
   SOCKET.IO
======================= */
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL 
    ],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
  transports: ["websocket"], // 🔥 avoids polling issues
});

// Make io accessible in routes
app.set("io", io);

/* =======================
   ROUTES
======================= */
import authRoutes from "./routes/authRouter.js";
import userRoutes from "./routes/userRouter.js";
import documentRoutes from "./routes/documentRouter.js";
import invitationsRoutes from "./routes/invitationRouter.js";

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/invitations", invitationsRoutes);

/* =======================
   DB
======================= */
const connectDB = async () => {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
      family: 4,
      serverSelectionTimeoutMS: 15000,
    });
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  }
};

connectDB();

/* =======================
   SOCKET EVENTS
======================= */
io.on("connection", async (socket) => {
  console.log("🟢 Socket connected:", socket.id);


   const allUsers = await User.find().select("_id name email role");
    socket.emit("recent-user-joins", allUsers);

  socket.on("join-role", (role) => {
    if (role === "OWNER" || role === "ADMIN") {
      socket.join("admins");
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
