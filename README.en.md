# Order Deduplication System

A **multi-company, multi-account, role-based** order management tool that detects **duplicate recipients** when you bulk-import order spreadsheets — so you never ship the same order twice.

![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-TBD-lightgrey)

> 中文文档：[README.md](README.md)

---

## Overview

In e-commerce, warehousing, and drop-shipping, the same batch of orders is often entered by several people across several spreadsheets. If one recipient gets entered twice, you ship twice — paying for the goods and the shipping a second time, with no easy way to trace it afterwards.

This project turns order spreadsheets into a searchable, de-duplicated database:

- **Import and check at once** — supports `.xlsx` / `.xls` / `.csv`, multiple files per import, with automatic header detection;
- **Four-field matching** — a duplicate is defined by *name + address + phone + product model*, with full-width/half-width normalization so formatting differences don't hide duplicates;
- **Group-by-group review** — duplicates are shown as groups; you pick the record to keep and the confirmed duplicates are **physically deleted**, not merely flagged;
- **Automatic expiry** — imported data is cleaned up after 3 days, with no manual maintenance.

It is designed for self-hosting by an individual or a small team; all data lives in a local SQLite file with no external database service required.

---

## Features

| Area | Capability |
| --- | --- |
| 🔐 Accounts | Username + password login; registration requires an **invite code**; password-free guest access |
| 👥 Three roles | `super_admin` > `admin` > `user`, controlling visible pages and permitted actions |
| 🏢 Companies | Join an existing company or create a new one; company name is immutable after creation; admins can change the company password |
| 🕵️ Guest mode | Try every order feature without registering; **no data is retained** — everything is cleared on logout |
| ⏳ Account expiry | Accounts can be given a validity period; expired accounts are disabled and logged out automatically |
| 📤 Import | `.xlsx` / `.xls` / `.csv`; multi-file import; fuzzy header matching in Chinese and English; the **product model column is required** |
| 🔍 Duplicate detection | Four-field matching (name + address + phone + product model); duplicate rows are highlighted and summarized in a top banner |
| 🧐 Group review | Duplicate groups are reviewed one at a time; pick the record to keep and the rest are physically deleted |
| 📋 Order management | Browse, paginate, search by name/phone, filter by source file, create, edit, delete, bulk delete |
| 🏷️ Shipping status | Mark each order as *shipped* or *not shipped* |
| 📁 Source tracking | Every order records the file it came from, so you can filter or bulk-clean by file |
| ⏰ Automatic cleanup | Orders expire 3 days after import; a background job also clears expired accounts, empty companies, and leftover guest data |
| 🎨 Dual theme | Light (ink black on warm paper) and dark (warm charcoal with amber) themes, toggleable and remembered; dark by default |
| ✨ Motion | Split-screen login with a flip card, animated background, magnetic buttons, scroll reveals, count-up numbers — pure CSS, with `prefers-reduced-motion` fallback |

---

## Interface Preview

```
┌──────────────────────────────────────────────────────────────────────┐
│  🛡️ Order Dedup   [Orders|Users]              👤 username role  🌙 out│
├──────────────────────────────────────────────────────────────────────┤
│  ⚠️ 4 duplicate groups found (8 records)   ← shown only if duplicates │
├──────────────────────────────────────────────────────────────────────┤
│  [Upload] [New order] [Bulk delete]  [By file▼] [Check] [Review] 🔍 [↻]│
│  ┌────┬────┬──────┬────────┬──────┬────────┬──────┬──────┬────────┬────┐│
│  │ ☐  │ #  │State │ Name   │Phone │ Model  │Source│Ship  │Left    │Ops ││
│  ├────┼────┼──────┼────────┼──────┼────────┼──────┼──────┼────────┼────┤
│  │ ☐  │ 1  │ ⚠️   │ 张三   │138…  │ Type A │a.xlsx│ No   │2 days  │Edit││
│  │ ☐  │ 2  │ ✅   │ 张三   │138…  │ Type B │b.xlsx│ Yes  │1 day   │Edit││
│  └────┴────┴──────┴────────┴──────┴────────┴──────┴──────┴────────┴────┘│
│                             Page 1/10  <  >                           │
└──────────────────────────────────────────────────────────────────────┘
```

> This is a schematic; names and phone numbers are placeholders. 🌙 is the theme toggle. Admins and super admins also see an "Orders / Users" view switch in the top bar.

### Column reference

| Column | Meaning |
| --- | --- |
| ☐ | Checkbox for bulk operations |
| # | Auto-incrementing row number |
| State | ⚠️ duplicate / ✅ processed / blank = normal |
| Name / Address / Phone | Recipient details |
| Product model | Participates in four-field matching; required on import |
| Source | File the order was imported from |
| Ship | *Shipped* (blue tag) or *Not shipped* (grey tag) |
| Processed | Whether the record has been marked processed (green tag) |
| Time left | Time remaining before automatic deletion; turns red under 1 hour |
| Actions | Edit / review duplicate (on duplicate rows) / delete |

> (待补充：界面截图 / Screenshots)

---

## Tech Stack

**Frontend** — React 18 · TypeScript 5.3 · Vite 5 · Ant Design 5 · axios · dayjs

**Backend** — Python 3.9+ · FastAPI 0.104 · SQLAlchemy 2.0 · SQLite · Uvicorn

**Data processing** — pandas 2.1 · openpyxl 3.1

**Scheduling** — APScheduler 3.10

**Motion** — native CSS keyframes plus lightweight in-house components (no extra dependencies)

Exact dependency versions are pinned in `backend/requirements.txt` and `frontend/package.json`.

---

## Architecture

```
Browser (React SPA, dev port 3000)
   │  axios → /api/**  (Bearer token attached automatically)
   ▼
Vite dev proxy / Nginx reverse proxy in production
   ▼
FastAPI backend (backend/main.py, default port 8001)
   ├─ auth.py              session token validation and role checks
   ├─ main.py              31 REST endpoints (auth / company / invite / user / upload / orders / dedup)
   ├─ crud.py              business-layer data access
   ├─ models.py            ORM models for 4 tables (orders / users / companies / invite_codes)
   ├─ database.py          SQLAlchemy connection to SQLite (data/orders.db)
   ├─ excel_parser.py      spreadsheet parsing and fuzzy header matching
   ├─ duplicate_checker.py four-field duplicate detection
   └─ scheduler.py         background cleanup (expired orders / accounts / empty companies / guest data)
```

**Suggested reading order**

1. What the data looks like → `backend/models.py`, `backend/database.py`
2. What happens to a request → `backend/main.py` (all routes)
3. How a spreadsheet becomes orders → `backend/excel_parser.py` → `backend/duplicate_checker.py` → `backend/crud.py`
4. Which page a button belongs to → `frontend/src/App.tsx` → `frontend/src/pages/` → `frontend/src/components/`
5. How the frontend calls the backend → `frontend/src/api/index.ts` (every API call is wrapped in this one file)

---

## Getting Started

### Requirements

| Dependency | Version | Notes |
| --- | --- | --- |
| Python | 3.9+ | Required by `pandas 2.1.4` |
| Node.js | 18+ | `deploy/deploy.sh` installs 20 LTS |
| npm | bundled with Node.js | Used to install frontend dependencies |

No database setup is needed — the SQLite file is created automatically on first start.

### Option 1: One-click start on Windows

Double-click `启动.bat` in the project root. The script installs Python and npm dependencies, frees ports 3000 and 8001, starts both services in the background, and opens your browser.

When startup finishes, the terminal shows:

```
系统启动完成！
前端地址: http://localhost:3000
后端 API: http://localhost:8001/docs
```

If the browser does not open automatically, visit <http://localhost:3000>.

### Option 2: Manual start (any platform)

```bash
# Terminal 1 — backend (port 8001)
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload

# Terminal 2 — frontend (port 3000)
cd frontend
npm install
npm run dev
```

- Web UI: <http://localhost:3000>
- API docs (Swagger UI): <http://localhost:8001/docs>
- `frontend/vite.config.ts` proxies `/api/**` to `http://localhost:8001` automatically.

### First login

On first start, `backend/seed.py` creates a preset super admin and company account (idempotent — restarting will not recreate them).

> ⚠️ **Security notice**: The preset account is created by `backend/seed.py` and its default password `123123` is written directly in the source — anyone who can read the source can log into an instance that still uses it. Override it with an environment variable before any real deployment; see the next section.

### Changing the super admin details

The super admin and the preset company are created **only on first start, when that account does not exist yet** (`seed.py` is idempotent). Changing the configuration and changing existing data are therefore two different paths.

**1. Before the first initialisation — environment variables (recommended)**

Set these before starting the backend; `seed.py` reads them first:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SUPER_ADMIN_USERNAME` | `admin` | Super admin username |
| `SUPER_ADMIN_PASSWORD` | `123123` | Super admin login password |
| `SUPER_ADMIN_COMPANY` | `我的公司` | Preset company name |
| `SUPER_ADMIN_EMAIL` | `admin@example.com` | Super admin email |

```bash
# Windows PowerShell
$env:SUPER_ADMIN_PASSWORD = "use-a-strong-password"
cd backend; python -m uvicorn main:app --host 127.0.0.1 --port 8001

# Linux / macOS
export SUPER_ADMIN_PASSWORD="use-a-strong-password"
cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

**2. After initialisation — change it in the UI**

| What | How |
| --- | --- |
| Login password | User menu → *Change login password*; `PUT /api/auth/password` |
| Company password | *Users → Change company password*; `PUT /api/companies/password` |
| Account validity | *Users → Account management → Extend validity*; `PUT /api/admin/users/{id}/extend` |

> Changing your login password does **not** immediately invalidate existing sessions (`users.token` is not cleared). Clear the account under *Users* if you need to force a logout.

**3. Username / email / company name have no edit path**

These three fields are written only at creation time; neither the UI nor the backend exposes an update endpoint, and the company name is fixed once created. To change them you have two options:

1. **Delete `data/orders.db` and re-initialise** — set the environment variables above, remove the database and restart. The account and company are recreated, but **all existing orders and accounts are lost** (back up first);
2. **Edit the database directly** — use a SQLite client to change the relevant fields in the `users` / `companies` tables of `data/orders.db`.

### Your first import and duplicate check

1. Click **Upload**, then drag in one or more `.xlsx` / `.xls` / `.csv` files;
2. The system auto-matches the columns (name, address, phone, **product model**). If a column is not matched, click ⚙️ to map it manually. **Import is blocked when the product model column is missing**;
3. Toggle *shipped* / *not shipped* per file, then click **Import all**;
4. If duplicates are found, those rows are highlighted and a red banner appears at the top of the page;
5. Click **Review duplicates** to show only pending duplicates, then click **Handle duplicate** on a row and **choose which record to keep**;
6. The remaining confirmed duplicates are **physically deleted (irreversible)**, leaving only the record you kept.

> Design trade-off: confirmed duplicates are deleted outright rather than kept and flagged as "processed". Flagging alone would leave the duplicate in the database, where it could still be shipped by mistake.

### Everyday operations

| Task | How |
| --- | --- |
| Search orders | Enter a keyword in *Search name / phone* |
| Edit an order | Click **Edit** on the row |
| Delete orders | Click **Delete**, or select rows and click **Bulk delete** |
| Add manually | Click **New order** and fill in the form (product model required) |
| Re-check duplicates | Click **Check** to run a full scan at any time |
| Review duplicates | Click **Review duplicates** to enter review mode |
| Filter by file | Use the file dropdown in the toolbar |
| Clean up a bad import | Filter by that file, select its rows, and click **Bulk delete** |

---

## How Duplicates Are Determined

```
Key        : name + address + phone + product model (product model required)
Normalize  : strip whitespace + Unicode NFKC (full-width → half-width)
Condition  : ≥2 unexpired records share a key, and at least 1 of them is unprocessed
Special    : processed records still participate in comparison, so flagging
             can never mask a genuine duplicate; a group stops being reported
             only once every record in it has been processed
```

## Permissions and Security

```
Roles         : super_admin > admin > user
Passwords     : pbkdf2_hmac(SHA-256, 100,000 iterations, random salt), constant-time comparison
Sessions      : random session token in users.token, invalidated on logout or account disable
Authorization : dependency-injected token + account status (must be "active")
Isolation     : orders are filtered by orders.owner_id; accounts cannot see each other's orders
Serialization : models never emit password_hash or token
Retention     : orders are deleted 3 days after import (timedelta(days=3) in backend/models.py)
```

### Known limitations

- **Preset credentials** — `backend/seed.py` ships default passwords inside the repository. They must be changed before any public deployment (see the security notice above).
- **Single process** — SQLite plus in-memory state means the backend must run with a single worker (see the comment in `deploy/order-check.service`). It is not built for high concurrency.
- **No built-in HTTPS** — TLS must be terminated by a reverse proxy such as Nginx.
- **Session tokens are stored in plaintext** — `users.token` is not encrypted, so a leaked `data/orders.db` is equivalent to leaked sessions. Keep the database file safe.
- **No environment variable support** — all settings are source constants; see Configuration below.

---

## Configuration

This version has **no** `.env` or environment-variable mechanism. The adjustable settings are:

| Setting | Location | Default |
| --- | --- | --- |
| Data directory / database path | `backend/database.py` (`DATA_DIR`) | `data/orders.db` under the project root |
| Order retention | `backend/models.py` (`timedelta(days=3)`) | 3 days |
| Password iteration count | `backend/auth.py` | 100000 |
| Frontend dev port / API proxy | `frontend/vite.config.ts` | 3000 → `http://localhost:8001` |
| Local backend port | `启动.bat` | 8001 |
| Production backend port / proxy | `deploy/order-check.service`, `deploy/nginx.conf` | 8003 / listen 80 |

> (待补充：环境变量配置支持 / Environment variable support)

---

## Project Layout

```
order-check/
├── 启动.bat              One-click Windows launcher (deps → backend :8001 → frontend :3000)
├── .gitignore            Ignores database, logs, build output, sample spreadsheets
├── README.md             Chinese documentation
├── README.en.md          English documentation (this file)
├── docs/                 Requirements and design documents (Markdown, not runtime code)
├── data/                 Runtime data (git-ignored)
│   ├── orders.db         SQLite database — backing it up backs up everything
│   └── uploads/          Temporary directory for uploaded files
├── backend/              Python backend (FastAPI + SQLAlchemy)
├── frontend/             Frontend (React + TypeScript + Vite + Ant Design)
└── deploy/               Self-hosting scripts and configuration
```

### Backend `backend/`

| File | Responsibility |
| --- | --- |
| `main.py` | Application entry point; 31 REST endpoints (auth / company / invite / user / upload / orders / dedup), global error handling, CORS |
| `database.py` | SQLAlchemy SQLite connection, session factory and dependency, table creation and lightweight "add missing column" migration |
| `models.py` | ORM models for 4 tables and expiry calculation; serialization never leaks passwords |
| `auth.py` | Password hashing and verification, session token and invite code generation, role-based dependencies |
| `seed.py` | Idempotent preset data: super admin, company, guest account, and ownership backfill for legacy orders |
| `crud.py` | Business-layer data access: order CRUD and pagination, duplicate grouping, user/company/invite management |
| `excel_parser.py` | `.xlsx` / `.xls` / `.csv` parsing and fuzzy Chinese/English header matching |
| `duplicate_checker.py` | Four-field duplicate detection over NFKC-normalized values |
| `scheduler.py` | APScheduler jobs: expired orders, expired accounts, empty companies, guest leftovers |
| `requirements.txt` | Pinned Python dependencies |

Dependency direction: `main.py` (routes) → `crud.py` (operations) → `models.py` (schema); `main.py` also calls `auth.py`, `excel_parser.py`, `duplicate_checker.py`, `scheduler.py`, and `seed.py`.

### Frontend `frontend/`

| Path | Responsibility |
| --- | --- |
| `src/main.tsx` | React mount point |
| `src/App.tsx` | Global shell: theme → antd config → session → page state machine |
| `src/AuthContext.tsx` | Login state, session restore from localStorage, automatic logout on 401 |
| `src/ThemeContext.tsx` | Light/dark theme state persisted under the `dd_theme` localStorage key |
| `src/api/index.ts` | Every backend call (axios instance, Bearer token, unified error handling) |
| `src/types/index.ts` | Shared TypeScript type definitions |
| `src/pages/` | Pages: `Login`, `CompanySetup`, `Dashboard`, `UserManagement` |
| `src/components/` | Business components: `OrderTable`, `UploadModal`, `OrderForm`, `DuplicateAlert`, and others |
| `src/components/motion/` | Motion components: animated background, count-up numbers, magnetic buttons, scroll reveal, 3D tilt cards |
| `src/index.css`, `src/styles/motion.css` | Design-system variables (light/dark palettes) and all motion keyframes |

Call chain: `main.tsx` → `App.tsx` → `pages/Dashboard.tsx` → `components/*` → `api/index.ts` → backend `/api`.

---

## FAQ

**Where is the data stored, and how do I back it up?**
Everything lives in `data/orders.db` at the project root. **Copying that file backs up all data**, and the next start picks it up automatically. Copy it somewhere safe on a regular basis.

**I forgot my password.**
Ask an administrator to handle it under *Users → Account management* (extend validity or delete and recreate). There is no email-based password reset.

**How do I register a new account?**
An **invite code** is required. Super admins can issue level-1 (→ admin) and level-2 (→ user) codes; admins can only issue level-2 codes. Each code **works once and is then voided**; it cannot be reused. A new account inherits the validity period configured on the invite code.

**What is guest mode?**
"Sign in as guest" lets you try every order feature without registering, but **no data is retained** — everything is cleared when you log out. Guests have no access to user management.

**Can I change the 3-day expiry?**
Yes. Edit `timedelta(days=3)` in `backend/models.py`.

**Import says a column is unmatched.**
Click the ⚙️ icon on that file's row and pick the correct column in the dropdown. The **product model column is required**; when it is missing the import endpoint returns 400.

**Can I import the same file twice?**
No. Files are validated by name, and re-importing an already-imported filename is rejected with a "file already exists" message.

**I imported the wrong spreadsheet.**
Select that file in the toolbar's file dropdown, select the affected rows, and use **Bulk delete**.

**A port is already in use.**
Change the port in `frontend/vite.config.ts`, or stop whatever is using 3000/8001. `启动.bat` clears old processes on those ports first; if 3000 is taken, Vite falls back to 3001 — follow the terminal output.

**Where are the API docs?**
Visit <http://localhost:8001/docs> after starting the backend (Swagger UI) to browse and try every endpoint.

---

## Self-Hosting

The `deploy/` directory contains a self-hosting setup for a Linux server:

| File | Purpose |
| --- | --- |
| `deploy/deploy.sh` | One-shot deployment: system packages and Node.js, Python virtualenv and backend dependencies, frontend build, systemd and Nginx configuration, firewall port |
| `deploy/update.sh` | Update: fix permissions → rebuild the frontend → restart the backend |
| `deploy/order-check.service` | systemd unit for the backend (single worker) |
| `deploy/nginx.conf` | Nginx site: serves the built frontend and reverse-proxies `/api/` to the backend |

```bash
# On the server (Ubuntu in this example)
git clone <your-repository-url> /opt/order-check
cd /opt/order-check
sudo bash deploy/deploy.sh        # listen on port 80
sudo bash deploy/deploy.sh 8082   # or specify a port
```

> ⚠️ Before exposing this to the internet, change the default passwords in `backend/seed.py` and configure HTTPS plus access control on your reverse proxy.

## Contributing

Issues and pull requests are welcome.

1. Fork the repository and branch off `main`;
2. Keep each change focused, and explain the motivation and impact;
3. Make sure both backend and frontend start cleanly before submitting (see *Getting Started → Option 2*);
4. Reference the related issue in your pull request description.

> (待补充：贡献指南 CONTRIBUTING.md / Contributing guide)

---

## Version History

| Version | Date | Highlights |
| --- | --- | --- |
| v1.0 | 2026-07-14 | Initial frontend and backend; spreadsheet parsing with three-field matching (name + address + phone); order CRUD; multi-file import; 3-day TTL countdown; one-click de-duplication |
| v2.0 | 2026-07-28 | Added the product model field and upgraded to four-field matching; duplicate handling became group-by-group review; source-file tracking with filtering and cleanup; global error handling and request retry; rejection of duplicate imports by filename |
| v3.0 | 2026-08-05 – 08-07 | Three-tier roles with login and registration; companies and order isolation; account validity; guest mode; invite code management; self-hosting scripts and configuration |
| v3.1 | 2026-09-01 – 09-02 | Light/dark design system; brand logo; login page motion; product model made required; duplicate detection and handling fixes (processed records still compared; handling a duplicate now physically deletes it); UI wording unified to "handle" instead of "delete" |
| v3.2 | 2026-09-03 | "Orders / Users" view switch in the top bar; simplified invite code table |

## License

(待补充：许可证 / License)

Until a license is chosen, no permission to use this project is granted. If you intend others to use it freely, add a `LICENSE` file (MIT and Apache-2.0 are common choices).

## Contact

- Author: (待补充：作者 / Author)
- Contact: (待补充：邮箱或其他联系方式 / Email or other contact)
- Support: (待补充：Issue 地址或其他反馈渠道 / Issue tracker or other feedback channel)
