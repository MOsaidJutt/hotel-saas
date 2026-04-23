const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ── Verify JWT and attach user to req
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password").lean();
    if (!user || !user.active) {
      return res.status(401).json({ error: "User not found or inactive" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Role guards — call after authenticate
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Shorthand guards
const isSuperAdmin = requireRole("superadmin");
const isAdmin      = requireRole("superadmin", "admin");
const isManager    = requireRole("superadmin", "admin", "manager");
const isStaff      = requireRole("superadmin", "admin", "manager", "staff");

// ── Ensure req.user belongs to the tenant in the route
// Use after authenticate on tenant-scoped routes
function scopeToTenant(req, res, next) {
  if (req.user.role === "superadmin") return next(); // superadmin can access any tenant
  const tenantId = (req.params.tenantId || req.body.tenantId || "").toString();
  if (tenantId && req.user.tenantId?.toString() !== tenantId) {
    return res.status(403).json({ error: "Access denied to this tenant" });
  }
  next();
}

module.exports = { authenticate, requireRole, isSuperAdmin, isAdmin, isManager, isStaff, scopeToTenant };
