import nodemailer, { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: MailInput): Promise<void> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || "Mesa Reservations <no-reply@mesa.local>";
  if (!t) {
    console.log("[mail:dev]", { to, from, subject });
    console.log(text || html.replace(/<[^>]+>/g, ""));
    return;
  }
  try {
    await t.sendMail({ from, to, subject, html, text: text || html.replace(/<[^>]+>/g, "") });
  } catch (err) {
    console.error("[mail] send failed:", err);
  }
}

const wrap = (body: string) => `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #18160f;">
    <div style="font-size: 22px; font-weight: 700; color: #c4410c; letter-spacing: -0.02em; margin-bottom: 16px;">mesa</div>
    <div style="background: #fafaf8; border: 1px solid rgba(24,22,15,0.08); border-radius: 8px; padding: 20px; line-height: 1.6; font-size: 14px; color: #5c5248;">
      ${body}
    </div>
    <p style="font-size: 12px; color: #9a9088; margin-top: 16px;">Mesa — table reservations.</p>
  </div>
`;

interface ReservationCtx {
  guestName: string;
  restaurantName: string;
  tableLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
}

export function pendingGuestEmail(ctx: ReservationCtx): MailInput["html"] {
  return wrap(`
    <p>Hi ${ctx.guestName},</p>
    <p>Thanks for booking at <strong>${ctx.restaurantName}</strong>. Your reservation is <strong>pending confirmation</strong> by the restaurant.</p>
    <p style="margin: 16px 0; padding: 12px; background: #fff; border-left: 3px solid #c4410c;">
      <strong>Table ${ctx.tableLabel}</strong><br/>
      ${ctx.date} · ${ctx.startTime}–${ctx.endTime}<br/>
      ${ctx.partySize} guest${ctx.partySize === 1 ? "" : "s"}
    </p>
    <p>You'll receive another email as soon as the restaurant accepts or declines.</p>
  `);
}

export function pendingOwnerEmail(ctx: ReservationCtx & { contact: string }): MailInput["html"] {
  return wrap(`
    <p>New reservation request at <strong>${ctx.restaurantName}</strong>.</p>
    <p style="margin: 16px 0; padding: 12px; background: #fff; border-left: 3px solid #c4410c;">
      <strong>${ctx.guestName}</strong> · ${ctx.contact}<br/>
      Table ${ctx.tableLabel} · ${ctx.partySize} guest${ctx.partySize === 1 ? "" : "s"}<br/>
      ${ctx.date} · ${ctx.startTime}–${ctx.endTime}
    </p>
    <p>Open your dashboard to accept or decline.</p>
  `);
}

export function confirmedGuestEmail(ctx: ReservationCtx): MailInput["html"] {
  return wrap(`
    <p>Hi ${ctx.guestName},</p>
    <p>Your reservation at <strong>${ctx.restaurantName}</strong> is <strong style="color: #16a34a;">confirmed</strong>.</p>
    <p style="margin: 16px 0; padding: 12px; background: #fff; border-left: 3px solid #16a34a;">
      <strong>Table ${ctx.tableLabel}</strong><br/>
      ${ctx.date} · ${ctx.startTime}–${ctx.endTime}<br/>
      ${ctx.partySize} guest${ctx.partySize === 1 ? "" : "s"}
    </p>
    <p>See you soon.</p>
  `);
}

export function rejectedGuestEmail(ctx: ReservationCtx): MailInput["html"] {
  return wrap(`
    <p>Hi ${ctx.guestName},</p>
    <p>Sorry — your reservation at <strong>${ctx.restaurantName}</strong> couldn't be accepted for this time. Please try a different slot.</p>
    <p style="margin: 16px 0; padding: 12px; background: #fff; border-left: 3px solid #dc2626;">
      Table ${ctx.tableLabel} · ${ctx.date} · ${ctx.startTime}–${ctx.endTime}
    </p>
  `);
}
