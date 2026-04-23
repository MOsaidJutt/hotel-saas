const nodemailer = require("nodemailer");

// ── Build transporter lazily (only when SMTP is configured)
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ── Generic send helper
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("⚠️  Email not sent — SMTP not configured in .env");
    return { skipped: true };
  }
  return transporter.sendMail({
    from: process.env.SMTP_FROM || "Onesol Hotel <noreply@onesol.com>",
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""),
  });
}

// ═══════════════════════════════════════════════════════
// ESCALATION ALERT
// ═══════════════════════════════════════════════════════
async function sendEscalationAlert({ to, hotelName, requests }) {
  if (!requests?.length) return;

  const rows = requests.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;color:#64748b">${r.reqId}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${r.guestLabel || "Guest"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${r.roomNumber || "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${r.type}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${r.departmentName}</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px">
      <div style="background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:10px;padding:20px 24px;margin-bottom:20px">
        <h1 style="color:#fff;margin:0;font-size:20px">⚠️ Escalation Alert</h1>
        <p style="color:#fecaca;margin:6px 0 0;font-size:14px">${hotelName}</p>
      </div>
      <p style="color:#374151;font-size:14px;margin:0 0 16px">
        <strong>${requests.length} request${requests.length > 1 ? "s have" : " has"} been auto-escalated</strong> due to no response within the department's time limit.
      </p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8">ID</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8">Guest</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8">Room</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8">Request</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8">Department</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">Log in to your dashboard to take action on these requests.</p>
    </div>
  `;

  return sendEmail({ to, subject: `⚠️ ${requests.length} Request${requests.length > 1 ? "s" : ""} Escalated — ${hotelName}`, html });
}

// ═══════════════════════════════════════════════════════
// DAILY DIGEST
// ═══════════════════════════════════════════════════════
async function sendDailyDigest({ to, hotelName, stats, topDepts, recentEscalated }) {
  const deptRows = (topDepts || []).map(d => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${d.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center">${d.open}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;color:#10b981">${d.completed}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;color:#ef4444">${d.escalated}</td>
    </tr>
  `).join("");

  const escalatedRows = (recentEscalated || []).slice(0, 5).map(r => `
    <tr>
      <td style="padding:6px 12px;font-size:12px;color:#64748b;font-family:monospace">${r.reqId}</td>
      <td style="padding:6px 12px;font-size:12px">${r.guestLabel || "Guest"}</td>
      <td style="padding:6px 12px;font-size:12px">${r.type}</td>
      <td style="padding:6px 12px;font-size:12px">${r.departmentName}</td>
    </tr>
  `).join("");

  const today = new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px">
      <div style="background:linear-gradient(135deg,#10b981,#0d9488);border-radius:10px;padding:20px 24px;margin-bottom:20px">
        <h1 style="color:#fff;margin:0;font-size:20px">📊 Daily Operations Digest</h1>
        <p style="color:#a7f3d0;margin:6px 0 0;font-size:13px">${hotelName} · ${today}</p>
      </div>

      <!-- KPI row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
        ${[
          { label:"Total Requests", value: stats.total, color:"#3b82f6" },
          { label:"Open",           value: stats.open,  color:"#f59e0b" },
          { label:"Completed",      value: stats.completed, color:"#10b981" },
          { label:"Escalated",      value: stats.escalated, color:"#ef4444" },
        ].map(s=>`
          <div style="background:#fff;border-radius:8px;padding:14px 12px;text-align:center;border:1px solid #e2e8f0">
            <div style="font-size:24px;font-weight:700;color:${s.color}">${s.value}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px">${s.label}</div>
          </div>
        `).join("")}
      </div>

      ${deptRows ? `
      <h3 style="font-size:13px;font-weight:600;color:#374151;margin:0 0 10px">By Department</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8">Department</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#94a3b8">Open</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#94a3b8">Done</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#94a3b8">Escalated</th>
        </tr></thead>
        <tbody>${deptRows}</tbody>
      </table>` : ""}

      ${escalatedRows ? `
      <h3 style="font-size:13px;font-weight:600;color:#374151;margin:0 0 10px">Recent Escalations</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px">
        <thead><tr style="background:#fef2f2">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8">ID</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8">Guest</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8">Request</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8">Department</th>
        </tr></thead>
        <tbody>${escalatedRows}</tbody>
      </table>` : ""}

      <p style="color:#94a3b8;font-size:12px;margin:0">This digest is sent daily at ${process.env.DIGEST_HOUR || 8}:00 AM. Log in to your dashboard to manage requests.</p>
    </div>
  `;

  return sendEmail({ to, subject: `📊 Daily Digest — ${hotelName} · ${today}`, html });
}

module.exports = { sendEmail, sendEscalationAlert, sendDailyDigest, getTransporter };
