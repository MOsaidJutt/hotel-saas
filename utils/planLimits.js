// ── Plan limits — -1 means unlimited
const PLAN_LIMITS = {
  starter:      { requestsPerMonth: 500,   staff: 5,   departments: 3,  aiResponses: 1000 },
  professional: { requestsPerMonth: 2000,  staff: 15,  departments: 10, aiResponses: 5000 },
  business:     { requestsPerMonth: 10000, staff: 50,  departments: 25, aiResponses: 20000 },
  enterprise:   { requestsPerMonth: -1,    staff: -1,  departments: -1, aiResponses: -1 },
};

const PLAN_LABELS = {
  starter:      { label: "Starter",      color: "#94a3b8", price: "$49/mo" },
  professional: { label: "Professional", color: "#3b82f6", price: "$149/mo" },
  business:     { label: "Business",     color: "#8b5cf6", price: "$399/mo" },
  enterprise:   { label: "Enterprise",   color: "#10b981", price: "Custom" },
};

function getLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
}

function isUnlimited(val) {
  return val === -1;
}

function usagePct(used, limit) {
  if (isUnlimited(limit)) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function isAtLimit(used, limit) {
  if (isUnlimited(limit)) return false;
  return used >= limit;
}

module.exports = { PLAN_LIMITS, PLAN_LABELS, getLimits, isUnlimited, usagePct, isAtLimit };
