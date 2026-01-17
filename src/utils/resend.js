import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const sendInvitationEmail = async (email, link) => {
  await resend.emails.send({
    from: "User Portal <onboarding@resend.dev>",
    to: email,
    subject: "You're invited",
    html: `<p>Click to accept invite:</p><a href="${link}">${link}</a>`,
  });
};

export { sendInvitationEmail };