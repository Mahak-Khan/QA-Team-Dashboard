# QualityHub - Modern QA Team & Defect Tracking Dashboard

An enterprise-grade, full-stack QA Management and Defect Tracking web application built with **FastAPI**, **MySQL**, **React 19**, and **Vite**. Features dark obsidian glassmorphism aesthetics, role-based workflows for QA Managers and Testers, live Google Sheets metrics synchronization, and real-time notification alerts.

---

## 🌟 Key Features

- **Role-Based Access Control**:
  - **Manager Dashboard**: Project portfolio management, tester team onboarding, project assignments, live progress tracking, and defect metrics.
  - **Tester Dashboard**: Assigned projects view, sprint progress reporting, defect submission with severity classifications, and direct testing sheet integration.
- **Defect Tracking & Sheet Sync**:
  - Track bug tallies (`Open`, `Need Retest`, `Retested`, `Closed`, `Critical`).
  - Link live external Google Sheets or Excel testing sheets with instant metric syncing.
- **Smart Notification System**:
  - Real-time alerts for QA Managers when testers report **Critical Bugs** or submit **Sprint Progress Updates**.
  - Direct task assignment notifications for Testers with one-click workspace navigation.
- **Glassmorphic UI & Visual Polish**:
  - Custom dark obsidian glassmorphic theme with glowing accents, responsive grid cards, and verified deletion modals (`ConfirmModal`).
- **High Performance & Optimized**:
  - Optimized SQLAlchemy connection pooling and aggregated `GROUP BY` database queries.
  - Frontend code-splitting with `React.lazy` and visibility-aware background polling.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, React Router v7, Vanilla CSS (Design Tokens, Glassmorphism) |
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy, Pydantic, Uvicorn, Jose (JWT), Pwdlib (Argon2) |
| **Database** | MySQL 8.0+ / MariaDB |

---

## 📂 Project Structure

```text
QA-Team-Dashboard/
├── backend/
│   ├── app/
│   │   ├── core/         # Security, JWT auth, dependencies
│   │   ├── models/       # SQLAlchemy ORM models (User, Project, Bug, Notification, etc.)
│   │   ├── routers/      # API endpoints (auth, projects, team, bugs, notifications)
│   │   ├── schemas/      # Pydantic data schemas
│   │   └── database.py   # Connection pool configuration
│   ├── main.py           # FastAPI application entry point & migrations
│   ├── requirements.txt  # Python backend dependencies
│   ├── test_api_suite.py # 36-endpoint automated API verification suite
│   └── .env.example      # Backend environment variables template
├── database/
│   └── scripts/
│       └── schema.sql    # Complete MySQL database schema
├── frontend/
│   ├── src/
│   │   ├── components/   # Modals, layout (Topbar, Sidebar, NotificationBell), cards
│   │   ├── context/      # Toast and application contexts
│   │   ├── pages/        # Manager and Tester workspace routes
│   │   ├── services/     # Axios API service clients
│   │   ├── App.jsx       # Lazy route declarations & role protection
│   │   └── index.css     # Dark glassmorphic design system
│   ├── package.json      # Frontend dependencies
│   ├── vite.config.js    # Vite configuration
│   └── .env.example      # Frontend environment variables template
└── .gitignore            # Git exclusion rules (ignores node_modules, .venv, .env)
```

---

## 🚀 Quick Setup & Installation Guide

### Prerequisites
- **Node.js** (v18 or higher) & **npm**
- **Python** (v3.10 or higher)
- **MySQL Server** (v8.0 or higher) running locally or remotely

---

### Step 1: Database Setup
1. Start your local MySQL service.
2. Import the database schema:
   ```bash
   mysql -u root -p < database/scripts/schema.sql
   ```
   *(This creates the `qa_team_dashboard` database and all required tables with cascade rules).*

---

### Step 2: Backend Setup (FastAPI)
1. Open a terminal and navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure your `.env` file:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   ```
   Edit `.env` to match your MySQL credentials:
   ```env
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=qa_team_dashboard
   SECRET_KEY=super_secret_jwt_key_here
   ```
5. Start the FastAPI backend server:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be live at `http://127.0.0.1:8000` (API Docs available at `http://127.0.0.1:8000/docs`).

---

### Step 3: Frontend Setup (React + Vite)
1. Open a second terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install frontend packages:
   ```bash
   npm install
   ```
3. Configure your `.env` file:
   ```bash
   cp .env.example .env
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Access the web app at `http://localhost:5173`.

---

## 🧪 Automated Testing

To verify all 36 API endpoints across all HTTP methods (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`):
```bash
cd backend
python test_api_suite.py
```

---

## 🔒 Security Best Practices
- Sensitive files (`.env`, `node_modules/`, `.venv/`) are excluded via `.gitignore`.
- Password hashing is enforced via **Argon2id**.
- JWT tokens with 24-hour expiration for secure session management.
