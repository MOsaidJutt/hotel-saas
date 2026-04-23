# CLAUDE.md — Onesol Tech Hotel SaaS

## First thing to do in any new session
Read `PROJECT_MEMORY.md` in this directory. It is the single source of truth for the entire project. Do not explore the codebase before reading it.

---

## Project in one line
Multi-tenant WhatsApp AI hotel receptionist SaaS + real-time operations dashboard. Node.js · MongoDB · React · Green API · OpenAI GPT-4o-mini.

---

## Key files
| File | Purpose |
|---|---|
| `server.js` | Express + Socket.io + auto-escalation engine (60s interval) |
| `db.js` | MongoDB connection |
| `middleware/auth.js` | JWT auth + role guards: isSuperAdmin, isAdmin, isManager, isStaff |
| `models/` | Tenant, User, Department, Conversation, ServiceRequest, HotelConfig, KnowledgeBase |
| `routes/admin.js` | Hotel admin API: stats, analytics, conversations, requests, staff, guest profiles |
| `routes/webhook.js` | POST /webhook/:slug — multi-tenant WhatsApp message handler |
| `routes/botconfig.js` | Bot setup wizard API + knowledge base CRUD |
| `utils/promptBuilder.js` | Builds GPT system prompt from HotelConfig + KnowledgeBase records |
| `dashboard/src/App.jsx` | Main SPA — role-based routing: SuperAdminApp / HotelDashboard / DepartmentStaffApp |
| `dashboard/src/components/BotSetup.jsx` | 9-step bot configuration wizard |
| `dashboard/src/components/StaffComponents.jsx` | KnowledgeBasePage + DepartmentStaffApp |
| `.env` | OPENAI_API_KEY, MONGODB_URI, JWT_SECRET, BASE_URL, PORT, SUPER_ADMIN_* |
| `PROJECT_MEMORY.md` | Full project context document |

---

## Run
```bash
net start MongoDB                     # start MongoDB (Windows service)
node server.js                        # start bot + dashboard at localhost:3000
cd dashboard && npm run build         # rebuild after ANY frontend changes
```

---

## Architecture rules — do not violate

### Multi-tenant isolation
Every DB query on tenant-scoped models MUST include `tenantId`. The webhook route identifies the tenant via `/webhook/:slug`. Never mix data across tenants.

### awaitingReply gate
`conv.awaitingReply = true` routes ALL incoming messages to GPT — no static replies, no keyword detection. This prevents room numbers like "13" triggering menu item 13. Do not bypass or weaken this flag.

### Role hierarchy
`superadmin > admin > manager > staff`  
- `isStaff` guard allows all four roles  
- `isManager` allows superadmin/admin/manager only  
- Staff can only see requests for their assigned departments (`user.departments[]`)

### Dynamic system prompt
Bot config is stored in `HotelConfig` + `KnowledgeBase` DB collections per tenant. `utils/promptBuilder.js` assembles the GPT system prompt at runtime. `hotelData.js` is the legacy fallback only.

### Auto-escalation
`server.js` runs `setInterval(runEscalationCheck, 60000)` — reads each department's `escalationMinutes` and auto-escalates overdue requests. Do not remove this.

---

## Tone & style rules
- Bot persona: Alex — real human receptionist. Never robotic. Never "Request received."
- Warm, professional, conversational. 2–4 sentences per reply.
- Handle rude/unusual messages with calm professionalism, never break character.
- Never re-ask for information the guest already provided.

---

## What NOT to do
- Do not add a second database layer — MongoDB is the only store.
- Do not split App.jsx further unless asked — BotSetup.jsx and StaffComponents.jsx already extracted.
- Do not change webhook routing priority without understanding awaitingReply.
- Do not add console.log spam to production code.
- Do not double-count `aiResponses` — `askAI()` increments it; call `botSay(..., false)` after.
- Do not remove the `suppressReservedKeysWarning: true` from Conversation schema — required for `isNew` field.

---

## After making frontend changes
Always run:
```bash
cd dashboard && npm run build
```
Changes to `dashboard/src/` are not live until rebuilt into `public/`.

---

## Phases Completed / Remaining
| Phase | Status | Summary |
|---|---|---|
| 1 | ✅ | Multi-tenant SaaS foundation: models, JWT, webhook/:slug, Green API, Socket.io |
| 2 | ✅ | Bot config wizard, Knowledge Base, Department Staff app |
| 3 | ✅ | Send replies, full conv history, staff-dept assign, request actions, notifications |
| 4 | ✅ | Real analytics, auto-escalation engine, guest profile panel, request assignment |
| 5 | ✅ | Global search, CSV export, change password, onboarding checklist, super admin usage |
| 6 | ✅ | Email escalation alerts, daily digest scheduler, on-demand digest, reply templates CRUD + picker |
| 7 | ✅ | Plan enforcement (checkLimit on staff/dept creation), usage bars, Billing page, invoice CRUD (superadmin) |
