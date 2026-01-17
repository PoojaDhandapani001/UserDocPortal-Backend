import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from 'node:dns';

dotenv.config();

// Force Node.js to use Google DNS for all its lookups
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
const server = http.createServer(app);

// SOCKET.IO SETUP
const io = new Server(server, {
  cors: {
    origin: "*", // later restrict this
  },
});

// Make io accessible everywhere
app.set("io", io);

app.use(cors());
app.use(express.json());

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import documentRoutes from "./routes/documents.js";
import invitationsRoutes from "./routes/invitation.js";

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/invitations", invitationsRoutes);


const connectDB = async () => {
    try {
        // Clear any previous buffered commands
        mongoose.set('strictQuery', false); 
        
        await mongoose.connect(process.env.MONGO_URI, {
            family: 4, 
            serverSelectionTimeoutMS: 15000, // Give it more time for Reliance lag
        });
        console.log("✅ MongoDB Connected Successfully");
    } catch (err) {
        console.error("❌ Connection Failed:", err.message);
        process.exit(1);
    }
};

connectDB();

// SOCKET CONNECTION
io.on("connection", (socket) => {
  socket.on("test", (msg) => {
  console.log("Received:", msg);
});

  console.log("Socket connected:", socket.id);

  socket.on("join-role", (role) => {
    if (role === "OWNER" || role === "ADMIN") {
      socket.join("admins");
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
