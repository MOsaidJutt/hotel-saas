require("dotenv").config();
const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cors       = require("cors");
const path       = require("path");
const jwt        = require("jsonwebtoken");

const connectDB      = require("./db");
const User           = require("./models/User");
const Tenant         = require("./models/Tenant");
const ServiceRequest = require("./models/ServiceRequest");
const Department     = require("./models/Department");
const HotelConfig    = require("./models/HotelConfig");
require("./models/Invoice"); // register model
const { sendEscalationAlert, sendDailyDigest } = require("./utils/emailService");

// ─── Routes
const authRoutes       = require("./routes/auth");
const superAdminRoutes = require("./routes/superadmin");
const adminRoutes      = require("./routes/admin");
const botConfigRoutes  = require("./routes/botconfig");
const webhookRouter    = require("./routes/webhook");
const { buildTenantSnapshot } = require("./routes/webhook");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });

// ── Expose io globally so webhook route can emit updates
global.io = io;

const port = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth",       authRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/admin",      adminRoutes);
app.use("/api/botconfig",  botConfigRoutes);
app.use("/webhook",        webhookRouter);

// ─── Socket.io ──────────────────────────────────────────────────────────────
io.on("connection", async (socket) => {
  // Authenticate socket via token in handshake query
  const token = socket.handshake.query.token;
  if (!token) { socket.disconnect(); return; }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password").lean();
    if (!user) { socket.disconnect(); return; }

    socket.user = user;

    if (user.role === "superadmin") {
      socket.join("superadmin");
      console.log(`📊 Super admin connected`);
    } else if (user.tenantId) {
      const room = `tenant:${user.tenantId}`;
      socket.join(room);
      console.log(`📊 Client connected: tenant ${user.tenantId}`);

      // Send current snapshot immediately
      const snapshot = await buildTenantSnapshot(user.tenantId);
      socket.emit("liveUpdate", snapshot);
    }

    socket.on("disconnect", () => {
      console.log(`📊 Socket disconnected: ${user.email}`);
    });
  } catch {
    socket.disconnect();
  }
});

// ─── Dashboard SPA (catch-all) ───────────────────────────────────────────────
app.get("*", (req, res) => {
  const indexFile = path.join(__dirname, "public", "index.html");
  res.sendFile(indexFile, (err) => {
    if (err) res.status(200).send(
      "🤖 Onesol Tech Hotel SaaS — Run: cd dashboard && npm install && npm run build"
    );
  });
});

// ─── Seed super admin ────────────────────────────────────────────────────────
async function seedSuperAdmin() {
  const email    = process.env.SUPER_ADMIN_EMAIL    || "superadmin@onesol.com";
  const password = process.env.SUPER_ADMIN_PASSWORD || "Admin@123";
  const name     = process.env.SUPER_ADMIN_NAME     || "Super Admin";

  const existing = await User.findOne({ role: "superadmin" });
  if (existing) return;

  await User.create({ name, email, password, role: "superadmin" });
  console.log(`\n✅ Super admin seeded`);
  console.log(`   Email    : ${email}`);
  console.log(`   Password : ${password}`);
  console.log(`   ⚠️  Change this password after first login!\n`);
}

// ─── Auto-escalation engine ──────────────────────────────────────────────────
// Runs every 60 s — escalates requests overdue per department's escalationMinutes
async function runEscalationCheck() {
  try {
    const activeTenants = await Tenant.find({ status: { $in: ["active", "trial"] } }).select("_id").lean();
    for (const t of activeTenants) {
      const tenantId = t._id;

      // Load department escalation thresholds
      const depts = await Department.find({ tenantId, active: true }).select("name escalationMinutes").lean();
      if (!depts.length) continue;

      let escalatedAny = false;
      for (const dept of depts) {
        const thresholdMs = (dept.escalationMinutes || 30) * 60 * 1000;
        const cutoff = new Date(Date.now() - thresholdMs);

        const result = await ServiceRequest.updateMany(
          {
            tenantId,
            departmentName: dept.name,
            status: { $in: ["New", "In Progress"] },
            createdAt: { $lt: cutoff },
          },
          { $set: { status: "Escalated", escalatedAt: new Date() } }
        );

        if (result.modifiedCount > 0) {
          escalatedAny = true;
          console.log(`⏰ Auto-escalated ${result.modifiedCount} request(s) in [${dept.name}] for tenant ${tenantId}`);
        }
      }

      // If anything was escalated, push a live update + send email alert
      if (escalatedAny) {
        const { buildTenantSnapshot } = require("./routes/webhook");
        const snapshot = await buildTenantSnapshot(tenantId);
        global.io.to(`tenant:${tenantId}`).emit("liveUpdate", {
          ...snapshot,
          _alert: { type: "escalation", message: "Some requests were auto-escalated due to no response" },
        });

        // Send escalation email alert to tenant admin
        try {
          const justEscalated = await ServiceRequest.find({
            tenantId,
            status: "Escalated",
            escalatedAt: { $gte: new Date(Date.now() - 90000) },
          }).limit(50).lean();

          if (justEscalated.length > 0) {
            const adminUser = await User.findOne({ tenantId, role: "admin" }).select("email").lean();
            const config    = await HotelConfig.findOne({ tenantId }).select("hotelName").lean();
            if (adminUser?.email) {
              await sendEscalationAlert({
                to: adminUser.email,
                hotelName: config?.hotelName || "Your Hotel",
                requests: justEscalated.map(r => ({
                  reqId: r.reqId, guestLabel: r.guestLabel,
                  roomNumber: r.roomNumber, type: r.type, departmentName: r.departmentName,
                })),
              });
            }
          }
        } catch (emailErr) {
          console.warn("⚠️  Escalation email failed:", emailErr.message);
        }
      }
    }
  } catch (err) {
    console.error("Escalation engine error:", err.message);
  }
}

// ─── Daily digest scheduler ──────────────────────────────────────────────────
// Runs every 60 s — sends digest once per day at DIGEST_HOUR
const digestSentDates = new Map(); // tenantId → date string (YYYY-MM-DD)

async function runDailyDigest() {
  try {
    const now        = new Date();
    const hour       = now.getHours();
    const targetHour = Number(process.env.DIGEST_HOUR ?? 8);
    if (hour !== targetHour) return;

    const today = now.toISOString().slice(0, 10); // "2026-04-09"
    const activeTenants = await Tenant.find({ status: { $in: ["active", "trial"] } }).lean();
    const mongoose = require("mongoose");

    for (const t of activeTenants) {
      const key = t._id.toString();
      if (digestSentDates.get(key) === today) continue;
      digestSentDates.set(key, today);

      try {
        const tenantId = t._id;
        const oid = mongoose.Types.ObjectId.createFromHexString(tenantId.toString());

        const [adminUser, config, total, open, completed, escalated, topDepts, recentEscalated] = await Promise.all([
          User.findOne({ tenantId, role: "admin" }).select("email").lean(),
          HotelConfig.findOne({ tenantId }).select("hotelName").lean(),
          ServiceRequest.countDocuments({ tenantId }),
          ServiceRequest.countDocuments({ tenantId, status: { $in: ["New","In Progress"] } }),
          ServiceRequest.countDocuments({ tenantId, status: "Completed" }),
          ServiceRequest.countDocuments({ tenantId, status: "Escalated" }),
          ServiceRequest.aggregate([
            { $match: { tenantId: oid } },
            { $group: { _id: "$departmentName",
                open:      { $sum: { $cond: [{ $in: ["$status", ["New","In Progress"]] }, 1, 0] } },
                completed: { $sum: { $cond: [{ $eq:  ["$status", "Completed"]          }, 1, 0] } },
                escalated: { $sum: { $cond: [{ $eq:  ["$status", "Escalated"]          }, 1, 0] } },
            }},
            { $sort: { open: -1 } }, { $limit: 5 },
          ]),
          ServiceRequest.find({ tenantId, status: "Escalated" }).sort({ escalatedAt: -1 }).limit(5).lean(),
        ]);

        if (!adminUser?.email) continue;

        await sendDailyDigest({
          to: adminUser.email,
          hotelName: config?.hotelName || t.name || "Your Hotel",
          stats: { total, open, completed, escalated },
          topDepts: topDepts.map(d => ({ name: d._id || "Unknown", open: d.open, completed: d.completed, escalated: d.escalated })),
          recentEscalated: recentEscalated.map(r => ({ reqId: r.reqId, guestLabel: r.guestLabel, type: r.type, departmentName: r.departmentName })),
        });
        console.log(`📧 Daily digest sent to ${adminUser.email} for tenant ${key}`);
      } catch (tenantErr) {
        console.warn(`⚠️  Digest failed for tenant ${t._id}:`, tenantErr.message);
      }
    }
  } catch (err) {
    console.error("Daily digest engine error:", err.message);
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────────
(async () => {
  await connectDB();
  await seedSuperAdmin();

  // Start escalation engine (runs every 60 seconds)
  setInterval(runEscalationCheck, 60 * 1000);
  console.log("⏰ Auto-escalation engine started (60s interval)");

  // Start daily digest scheduler (checks every 60 seconds)
  setInterval(runDailyDigest, 60 * 1000);
  console.log(`📧 Daily digest scheduler started (fires at ${process.env.DIGEST_HOUR ?? 8}:00 AM)`);

  server.listen(port, () => {
    console.log(`\n🚀 Onesol Tech Hotel SaaS running`);
    console.log(`   Dashboard : http://localhost:${port}`);
    console.log(`   API       : http://localhost:${port}/api`);
    console.log(`   Webhook   : http://localhost:${port}/webhook/<hotel-slug>\n`);
  });
})();
