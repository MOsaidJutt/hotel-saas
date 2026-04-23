const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    // ── Identity
    name:       { type: String, required: true, trim: true },   // "Grand Luxury Hotel"
    slug:       { type: String, required: true, unique: true, lowercase: true, trim: true }, // "grand-luxury"
    email:      { type: String, required: true, unique: true, lowercase: true },
    phone:      { type: String, default: "" },

    // ── Branding
    logo:       { type: String, default: "" },  // URL
    primaryColor: { type: String, default: "#10b981" },

    // ── Subscription
    plan:       { type: String, enum: ["starter", "professional", "business", "enterprise"], default: "starter" },
    status:     { type: String, enum: ["active", "suspended", "trial"], default: "trial" },
    trialEnds:  { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },

    // ── Green API (WhatsApp)
    greenApi: {
      idInstance:       { type: String, default: "" },
      apiTokenInstance: { type: String, default: "" },
      phoneNumber:      { type: String, default: "" },
      instanceState:    { type: String, default: "notAuthorized" }, // notAuthorized | authorized | blocked
      lastChecked:      { type: Date },
    },

    // ── Bot Persona
    botPersona: {
      name:     { type: String, default: "Alex" },
      role:     { type: String, default: "Senior Front Desk Executive" },
      hotelName:{ type: String, default: "" },
      customPrompt: { type: String, default: "" }, // appended to base system prompt
    },

    // ── Settings
    timezone:   { type: String, default: "Asia/Karachi" },
    webhookUrl: { type: String, default: "" }, // auto-set: yourdomain.com/webhook/<slug>

    // ── Counters (lightweight live stats cached here)
    stats: {
      totalConversations: { type: Number, default: 0 },
      totalRequests:      { type: Number, default: 0 },
      aiResponses:        { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tenant", tenantSchema);
