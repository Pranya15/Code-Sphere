import nodemailer from "nodemailer";

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });
}

export async function sendWorkspaceInviteEmail({ to, workspaceName, inviterName, inviteUrl, role }) {
  const transport = getTransport();
  if (!transport) {
    return {
      status: "manual",
      message: "SMTP is not configured. Copy and share the invite link manually."
    };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `${inviterName} invited you to ${workspaceName}`,
    text: [
      `${inviterName} invited you to join ${workspaceName} as ${role}.`,
      "",
      `Accept the invitation: ${inviteUrl}`,
      "",
      "Sign in with Google, GitHub, LinkedIn, Microsoft, or email to join the workspace."
    ].join("\n"),
    html: `
      <p>${inviterName} invited you to join <strong>${workspaceName}</strong> as <strong>${role}</strong>.</p>
      <p><a href="${inviteUrl}">Accept invitation</a></p>
      <p>Sign in with Google, GitHub, LinkedIn, Microsoft, or email to join the workspace.</p>
    `
  });

  return { status: "sent", message: `Invitation email sent to ${to}.` };
}
