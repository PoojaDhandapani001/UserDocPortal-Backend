import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema({
    email: { type: String, required: true },
    role: { type: String, required: true },
    previewUrl: { type: String},
    token: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "EXPIRED"],
      default: "PENDING",
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true });

  /* INDEXES */
invitationSchema.index({ email: 1 });
invitationSchema.index({ status: 1, expiresAt: 1 });

// TTL – auto delete expired invitations
invitationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

export default mongoose.model("Invitation", invitationSchema);
