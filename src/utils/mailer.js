import nodemailer from "nodemailer";

// For development: create test account
export const createTestAccount = async () => {
  const testAccount = await nodemailer.createTestAccount();
  console.log("Ethereal account created", testAccount);
  return testAccount;
};

// Create reusable transporter
export const createTransporter = async () => {
  // Use Ethereal SMTP
  const testAccount = await createTestAccount();

  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

// Send invitation email
export const sendInvitationEmail = async (email, inviteLink) => {
  const transporter = await createTransporter();

  const info = await transporter.sendMail({
    from: '"UserDoc Portal" <no-reply@userdoc.com>',
    to: email,
    subject: "You have been invited!",
    html: `<p>You have been invited to join UserDoc Portal.</p>
           <p>Click <a href="${inviteLink}">here</a> to accept the invitation.</p>
           <p>This link expires in 24 hours.</p>`,
  });

  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
};
