const mongoose = require("mongoose");

// ── Custom field schema (the Department Builder's core)
const fieldSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true },   // "Request Type", "Room Number"
    type:        { type: String, enum: ["text", "number", "dropdown", "timepicker", "toggle"], required: true },
    options:     [String],   // only for dropdown type
    required:    { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
  },
  { _id: true }
);

const departmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },

    // ── Identity
    name:    { type: String, required: true, trim: true },  // "Housekeeping", "Pool Services"
    icon:    { type: String, default: "🛎" },               // emoji
    color:   { type: String, default: "#10b981" },          // hex colour for dashboard badge

    // ── WhatsApp menu
    menuOrder: { type: Number, default: 99 },               // position in bot menu
    keywords:  [String],                                    // ["towel", "clean", "pillow"]

    // ── Custom fields for service requests in this dept
    fields: [fieldSchema],

    // ── Escalation rules
    escalationMinutes: { type: Number, default: 30 },       // alert if open > N minutes
    maxConcurrentLoad: { type: Number, default: 5 },        // alert if queue > N

    // ── Status
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound index — dept names must be unique per tenant
departmentSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Department", departmentSchema);
