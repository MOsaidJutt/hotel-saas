const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ── Identity
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false }, // never returned by default

    // ── Role
    // superadmin  → global access, no tenantId
    // admin       → full access to their tenant
    // manager     → access to one or more departments within tenant
    // staff       → read + action only, no config
    role: {
      type: String,
      enum: ["superadmin", "admin", "manager", "staff"],
      default: "staff",
    },

    // ── Tenant binding (null for superadmin)
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },

    // ── Department scope (for manager/staff roles)
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],

    // ── Status
    active: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare plain password with hash
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", userSchema);
