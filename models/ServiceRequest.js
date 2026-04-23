const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema(
  {
    tenantId:     { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },

    // ── Identity
    reqId:        { type: String, required: true },   // "REQ-0001"
    chatId:       { type: String },
    guestLabel:   { type: String, default: "" },
    roomNumber:   { type: String, default: "" },

    // ── Request details
    departmentName: { type: String, required: true },
    type:           { type: String, required: true }, // short description / first 50 chars of message

    // ── Dynamic field values (matches Department.fields)
    fieldValues: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },

    // ── Status lifecycle
    status: {
      type: String,
      enum: ["New", "In Progress", "Escalated", "Completed", "Cancelled"],
      default: "New",
    },

    // ── Assignment
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ── Timestamps
    time:        { type: String },      // formatted "02:45 PM"
    completedAt: { type: Date },
    escalatedAt: { type: Date },
  },
  { timestamps: true }
);

serviceRequestSchema.index({ tenantId: 1, createdAt: -1 });
serviceRequestSchema.index({ tenantId: 1, departmentName: 1 });

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
