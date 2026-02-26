import { Resend } from "resend";

// Resend client — lazily initialised so missing API key only throws at send time
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "Rio-Aus Flights <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

// ─── Base template ────────────────────────────────────────────

function baseTemplate(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rio-Aus Flights</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:20px;font-weight:800;color:#111827;letter-spacing:-0.5px;">Rio<span style="color:#2563eb;">-Aus</span></span>
            <span style="color:#d1d5db;font-weight:300;margin-left:4px;">✈</span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;background:#f9fafb;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Rio-Aus Flights · Australia ↔ Brazil<br/>
              You're receiving this because you have an account at
              <a href="${APP_URL}" style="color:#6b7280;">${APP_URL.replace(/^https?:\/\//, "")}</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:24px;">${label}</a>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.5px;">${text}</h1>`;
}

function p(text: string, muted = false) {
  return `<p style="margin:12px 0;font-size:15px;line-height:1.6;color:${muted ? "#6b7280" : "#374151"};">${text}</p>`;
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${label}</td>
    <td style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;text-align:right;">${value}</td>
  </tr>`;
}

function infoTable(rows: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">${rows}</table>`;
}

// ─── Fire-and-forget helper ────────────────────────────────────

async function send(opts: { to: string; subject: string; html: string }) {
  try {
    const { error } = await getResend().emails.send({ from: FROM, ...opts });
    if (error) console.error("[email] Resend error:", error);
  } catch (err) {
    console.error("[email] Failed to send:", err);
  }
}

// ─── Templates ────────────────────────────────────────────────

export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  await send({
    to,
    subject: "Welcome to Rio-Aus Flights ✈️",
    html: baseTemplate(`
      ${h1(`Welcome, ${name}!`)}
      ${p("You're now part of the Rio-Aus community. We organise group charter flights between Australia and Brazil twice a year.")}
      ${p("The more people who join a campaign, the cheaper the ticket gets for everyone. Share the link with friends — every seat added lowers the price.", true)}
      ${btn("View open campaigns", `${APP_URL}/campaigns`)}
    `),
  });
}

export async function sendVoteConfirmedEmail({
  to,
  name,
  campaignTitle,
  dateVoted,
  campaignId,
}: {
  to: string;
  name: string;
  campaignTitle: string;
  dateVoted: string;
  campaignId: string;
}) {
  await send({
    to,
    subject: `Vote received — ${campaignTitle}`,
    html: baseTemplate(`
      ${h1("Your vote is in! 🗳️")}
      ${p(`Thanks ${name}, we've recorded your vote for the campaign below.`)}
      ${infoTable(
        infoRow("Campaign", campaignTitle) +
        infoRow("Your vote", dateVoted)
      )}
      ${p("We'll notify you when voting closes and the winning date is confirmed.", true)}
      ${btn("View campaign", `${APP_URL}/campaigns/${campaignId}`)}
    `),
  });
}

export async function sendBookingReceivedEmail({
  to,
  name,
  campaignTitle,
  passengerCount,
  seatClass,
  currentPricePerPerson,
  campaignId,
}: {
  to: string;
  name: string;
  campaignTitle: string;
  passengerCount: number;
  seatClass: string;
  currentPricePerPerson: string | null;
  campaignId: string;
}) {
  const priceNote = currentPricePerPerson
    ? `Current estimate: <strong>${currentPricePerPerson}/person</strong> (drops as more people join)`
    : "Price will be set once the charter cost is confirmed.";

  await send({
    to,
    subject: `Booking received — ${campaignTitle}`,
    html: baseTemplate(`
      ${h1("You're in the queue! 🎫")}
      ${p(`Hi ${name}, your booking request has been received. It will be confirmed once the admin closes the charter deal with Qantas.`)}
      ${infoTable(
        infoRow("Campaign", campaignTitle) +
        infoRow("Passengers", `${passengerCount} × ${seatClass.charAt(0) + seatClass.slice(1).toLowerCase()}`) +
        infoRow("Status", "Pending confirmation")
      )}
      ${p(priceNote, true)}
      ${p("Share the campaign link with friends and family — every new passenger lowers the price for everyone.", true)}
      ${btn("View my booking", `${APP_URL}/campaigns/${campaignId}`)}
    `),
  });
}

export async function sendFlightConfirmedEmail({
  to,
  name,
  campaignTitle,
  route,
  confirmedDate,
  pricePerPerson,
  campaignId,
}: {
  to: string;
  name: string;
  campaignTitle: string;
  route: string;
  confirmedDate: string;
  pricePerPerson: string | null;
  campaignId: string;
}) {
  const priceRow = pricePerPerson ? infoRow("Your price", pricePerPerson + " per person") : "";

  await send({
    to,
    subject: `✈️ Flight confirmed — ${confirmedDate}`,
    html: baseTemplate(`
      ${h1("Your flight is confirmed! 🎉")}
      ${p(`Great news ${name}! The admin has closed the charter deal with Qantas. Your booking for <strong>${campaignTitle}</strong> is now confirmed.`)}
      ${infoTable(
        infoRow("Route", route) +
        infoRow("Flight date", confirmedDate) +
        priceRow +
        infoRow("Booking status", "✓ Confirmed")
      )}
      ${p("You'll receive further details about payment and check-in closer to the flight date.", true)}
      ${btn("View my booking", `${APP_URL}/campaigns/${campaignId}`)}
    `),
  });
}

export async function sendCargoApprovedEmail({
  to,
  businessName,
  campaignTitle,
  weightKg,
  totalCost,
  campaignId,
}: {
  to: string;
  businessName: string;
  campaignTitle: string;
  weightKg: number;
  totalCost: string;
  campaignId: string;
}) {
  await send({
    to,
    subject: `Cargo approved — ${campaignTitle}`,
    html: baseTemplate(`
      ${h1("Cargo request approved! 📦")}
      ${p(`Good news! Your cargo request for <strong>${businessName}</strong> has been approved by the admin.`)}
      ${infoTable(
        infoRow("Campaign", campaignTitle) +
        infoRow("Weight", `${weightKg}kg`) +
        infoRow("Total cargo cost", totalCost) +
        infoRow("Status", "✓ Approved")
      )}
      ${p("Your cargo revenue has been applied to reduce the passenger ticket price. Payment details will follow.", true)}
      ${btn("View campaign", `${APP_URL}/campaigns/${campaignId}`)}
    `),
  });
}

export async function sendCargoRejectedEmail({
  to,
  businessName,
  campaignTitle,
  reason,
  campaignId,
}: {
  to: string;
  businessName: string;
  campaignTitle: string;
  reason: string | null;
  campaignId: string;
}) {
  await send({
    to,
    subject: `Cargo request update — ${campaignTitle}`,
    html: baseTemplate(`
      ${h1("Cargo request not approved")}
      ${p(`Hi, your cargo request for <strong>${businessName}</strong> was not approved for the campaign below.`)}
      ${infoTable(
        infoRow("Campaign", campaignTitle) +
        (reason ? infoRow("Reason", reason) : "")
      )}
      ${p("If you have questions, please reply to this email or contact us directly.", true)}
      ${btn("View campaign", `${APP_URL}/campaigns/${campaignId}`)}
    `),
  });
}
