const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    invoiceNo:   { type: String, required: true, unique: true },  // "INV-0001"
    period:      { type: String, required: true },                // "April 2026"
    periodStart: { type: Date,   required: true },
    periodEnd:   { type: Date,   required: true },
    plan:        { type: String, required: true },                // "professional"
    amount:      { type: Number, required: true },                // in USD cents (e.g. 14900 = $149)
    currency:    { type: String, default: "USD" },
    status:      { type: String, enum: ["draft","issued","paid","overdue","void"], default: "issued" },
    paidAt:      { type: Date },
    notes:       { type: String, default: "" },
    lineItems:   [{
      description: { type: String },
      quantity:    { type: Number, default: 1 },
      unitPrice:   { type: Number },                              // cents
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
