# PROJECT_MEMORY.md — Onesol Tech Hotel SaaS
> Complete context document. Read this at the start of any new session.
> See also: `CLAUDE.md` — hard rules and architectural constraints for Claude.
*Last updated: 2026-04-08*

---

## What This Is
A fully multi-tenant SaaS platform providing hotels with:
1. A WhatsApp AI receptionist (bot persona: Alex) powered by GPT-4o-mini
2. A real-time operations dashboard for hotel staff and management
3. A super-admin panel for managing multiple hotel clients

---

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express |
| Real-time | Socket.io (JWT-authenticated, tenant-scoped rooms) |
| Database | MongoDB 8.x via Mongoose 9 |
| Auth | JWT (HS256), role-based middleware |
| AI | OpenAI GPT-4o-mini |
| WhatsApp | Green API (per-tenant credentials) |
| Frontend | React + Vite + Tailwind CSS + Recharts |
| Tunnel | ngrok (exposes localhost webhook to Green API) |

---

## Environment Variables (.env)
```
OPENAI_API_KEY=...
MONGODB_URI=mongodb://127.0.0.1:27017/onesol-hotel
JWT_SECRET=onesol-hotel-jwt-super-secret-2024-change-in-production
SUPER_ADMIN_EMAIL=superadmin@onesol.com
SUPER_ADMIN_PASSWORD=Admin@123
SUPER_ADMIN_NAME=Super Admin
BASE_URL=https://<your-ngrok-url>.ngrok-free.app
PORT=3000
```

---

## File Structure
```
Hotel/
├── server.js                    # Express + Socket.io + auto-escalation engine (60s)
├── db.js                        # connectDB() — mongoose.connect(MONGODB_URI)
├── hotelData.js                 # Legacy static system prompt (fallback only)
├── .env
│
├── middleware/auth.js           # authenticate, isSuperAdmin, isAdmin, isManager, isStaff
│
├── models/
│   ├── Tenant.js                # name, slug, greenApi{idInstance, apiTokenInstance, instanceState}, botPersona, plan, status
│   ├── User.js                  # name, email, password(bcrypt), role, tenantId, departments[], active
│   ├── Department.js            # tenantId, name, icon, color, keywords[], fields[], escalationMinutes, maxConcurrentLoad
│   ├── Conversation.js          # tenantId, chatId, messages[], humanMode, awaitingReply, pendingService, roomNumber
│   ├── ServiceRequest.js        # tenantId, reqId, chatId, departmentName, type, fieldValues(Map), status, assignedTo
│   ├── HotelConfig.js           # One per tenant: hotelName, roomTypes[], facilities[], menuItems[], policies[], botPersona, setupCompleted
│   └── KnowledgeBase.js         # tenantId, question, answer, category, active, priority
│
├── routes/
│   ├── auth.js                  # POST /login, GET /me, POST /logout, POST /change-password
│   ├── superadmin.js            # Tenant CRUD + platform stats + per-tenant usage stats
│   ├── admin.js                 # Hotel ops: stats, analytics, conversations (search), requests (search+export), staff, departments, guest profiles, assignment
│   ├── botconfig.js             # Bot setup wizard + knowledge base CRUD + prompt preview
│   └── webhook.js               # POST /webhook/:slug — WhatsApp message handler
│
├── utils/promptBuilder.js       # buildSystemPromptFromConfig(config, kb) — builds GPT prompt from DB
│
└── dashboard/src/
    ├── App.jsx                  # Root SPA + all major components
    └── components/
        ├── BotSetup.jsx         # 9-step bot config wizard
        └── StaffComponents.jsx  # KnowledgeBasePage + DepartmentStaffApp
```

---

## Role Hierarchy & Access
| Role | What they see |
|---|---|
| `superadmin` | SuperAdminApp — all tenants, platform stats, per-tenant usage, create/suspend/delete |
| `admin` | Full HotelDashboard — all 9 pages, all requests, all staff, bot config |
| `manager` | HotelDashboard — conversations, requests, departments, analytics (no staff management) |
| `staff` | DepartmentStaffApp — scoped request queue (assigned departments only), accept/complete/escalate |

---

## Dashboard Pages (admin/manager view)
1. **Dashboard** — KPI cards (live), weekly chart, dept pie + onboarding checklist (when not set up)
2. **Conversations** — Search by name/phone/room + full message history + human takeover + send replies + guest profile panel
3. **Requests** — Search filter, status filter chips, Accept/Done/Escalate buttons, assign dropdown, **Export CSV**
4. **Departments** — Custom field builder (name, icon, keywords, field types, escalation threshold)
5. **Analytics** — Live DB charts: peak hours, status breakdown, dept breakdown, escalations, daily 30-day trend
6. **Staff** — CRUD + department assignment checkboxes + activate/deactivate + edit
7. **Bot Setup** — 9-step hotel configuration wizard (saves to HotelConfig in DB)
8. **Knowledge Base** — Custom Q&A injected into AI prompt (category + priority + active toggle)
9. **Settings** — Onboarding checklist + WhatsApp QR + Green API creds + integration status + **Change Password**

---

## Key API Routes
| Route | Auth | Purpose |
|---|---|---|
| POST /api/auth/login | public | JWT login |
| GET /api/auth/me | any | Current user (populates tenantId) |
| POST /api/auth/change-password | any | Change own password |
| GET /api/superadmin/tenants | superadmin | List all tenants |
| GET /api/superadmin/tenants/:id | superadmin | Tenant detail + usage stats |
| GET /api/admin/stats | manager+ | Dashboard KPIs |
| GET /api/admin/analytics | manager+ | Real analytics charts |
| GET /api/admin/conversations?search= | manager+ | Conversation list with search |
| POST /api/admin/conversations/:id/send | staff+ | Send WhatsApp reply |
| GET /api/admin/guest/:chatId | manager+ | Guest profile + history |
| GET /api/admin/requests?search= | manager+ | Requests with search |
| GET /api/admin/requests/export | manager+ | CSV download |
| PUT /api/admin/requests/:id/status | staff+ | Update request status |
| PUT /api/admin/requests/:id/assign | manager+ | Assign to staff |
| GET /api/botconfig | manager+ | Full hotel config |
| PUT /api/botconfig/basic|checkin|… | admin | Update config sections |
| GET/POST/PUT/DELETE /api/botconfig/kb | admin | Knowledge base CRUD |
| GET /api/botconfig/prompt-preview | manager+ | Preview AI system prompt |
| POST /webhook/:slug | public | WhatsApp message handler |

---

## Webhook Message Flow
```
Guest sends WhatsApp message
  → POST /webhook/:slug
  → Find tenant by slug (status: active OR trial)
  → Load departments from DB (for keyword routing)
  → Load/create conversation from DB
  → Priority routing:
      1. "menu" → show menu
      2. awaitingReply=true → GPT (skips all keyword shortcuts)
      3. Greeting + isNew → full menu
      4. Static menu numbers → hardcoded reply
      5. Department keyword match → confirm + ask room → set awaitingReply=true
      6. Everything else → GPT with 24-message history
  → Bot replies via Green API sendMessage
  → Save conversation to DB
  → Emit liveUpdate to Socket.io tenant room
```

---

## Auto-Escalation Engine
Runs every 60 seconds in `server.js` via `setInterval(runEscalationCheck, 60000)`:
- Queries all active/trial tenants
- For each department, finds requests older than `escalationMinutes` with status New or In Progress
- Sets those to Escalated, sets `escalatedAt`
- Emits Socket.io `liveUpdate` with `_alert: { type: "escalation" }` to tenant dashboard (red highlighted notification)

---

## Bot Config & System Prompt
- Admin fills 9-step wizard → saves to `HotelConfig` collection
- Admin adds Q&A to `KnowledgeBase` collection
- Each incoming message: `buildSystemPromptFromConfig(config, kb)` assembles full GPT prompt
- Falls back to `tenant.botPersona` fields if `setupCompleted = false`

---

## Key Architectural Rules
1. **awaitingReply gate** — When `true`, ALL messages go directly to GPT. Prevents "13" triggering Spa (menu item 13). Never bypass.
2. **Tenant isolation** — Every DB query on tenant-scoped models must include `tenantId`. Never omit.
3. **isNew field** — Conversation schema has `suppressReservedKeysWarning: true` (Mongoose reserved key workaround).
4. **Mongoose 9 async hooks** — Pre-save hooks use `async function()` with no `next` parameter.
5. **Socket.io auth** — Token in handshake query: `io(origin, { query: { token } })`.
6. **aiResponses counter** — `askAI()` increments it; call `botSay(..., false)` after to avoid double-counting.
7. **CSV export auth** — `GET /api/admin/requests/export` uses JWT in header, served as attachment. The `<a href>` download in the UI works because the API includes `Authorization` header via fetch — actually use a token-appended URL or open in new tab.

---

## Phases Completed
| Phase | What was built |
|---|---|
| 1 | Multi-tenant SaaS: all models, JWT auth, webhook/:slug, Green API per-tenant, Socket.io with JWT |
| 2 | Bot config wizard (BotSetup.jsx), Knowledge Base page, Department Staff logins (DepartmentStaffApp) |
| 3 | Human takeover send replies, full conversation history fetch, staff-dept assignment, request status actions, notifications |
| 4 | Real Analytics (live DB charts), auto-escalation engine, guest profile panel, request assignment to staff |
| 5 | Global search (conversations + requests), CSV export, change password, onboarding checklist, super admin usage stats, TenantDetailView |
| 6 | Email escalation alerts (auto-fired on escalation), daily digest scheduler (DIGEST_HOUR), on-demand digest endpoint, reply templates CRUD (HotelConfig.replyTemplates), template picker in Conversations human mode, Templates page, EmailNotificationsCard in Settings |

## Phases Remaining
| Phase | Plan |
|---|---|
| 7 | Billing & Limits: plan enforcement (request caps, staff limits), usage tracking, invoice history display |

---

## Known Working Config
- MongoDB: `localhost:27017`, db: `onesol-hotel`
- Green API webhook auto-registers on credential save in dashboard
- ngrok URL stored in `BASE_URL` env var AND must be updated in tenant.webhookUrl in DB when it changes
- Super admin auto-seeded on first boot (check .env for credentials)
- Default departments seeded on tenant creation: Housekeeping, Room Service, Concierge, Maintenance
