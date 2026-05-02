# 🎓 NetSupport MVP

<div align="center">

### ⚡ Real-Time Exam Platform for Modern Tutors

> **Stop manually grading. Stop tracking disconnected students. Stop wasting time.**
>
> NetSupport MVP conducts live exams at scale. One dashboard. Instant scoring. Professional reports.

[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![ASP.NET Core](https://img.shields.io/badge/Backend-ASP.NET%20Core%206-512BD4?style=flat-square&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![SignalR](https://img.shields.io/badge/RealTime-SignalR-09B3AF?style=flat-square)](https://github.com/SignalR)
[![SQL Server](https://img.shields.io/badge/Database-SQL%20Server-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)

</div>

---

## 🔥 The Problem

Running live exams is **chaotic**:

| Issue | Impact |
|-------|--------|
| ❌ Manual grading | Takes hours after the exam ends |
| ❌ Student disconnects | Lose progress mid-test |
| ❌ No real-time control | Can't enforce exam integrity |
| ❌ Manual reports | Tedious, error-prone |
| ❌ Scale limitations | 20+ students = impossible to manage |

---

## ✨ The Solution

| Feature | Benefit |
|---------|---------|
| ⚡ **Instant Scoring** | Answers graded in real-time as students submit |
| 🎮 **Real-Time Control** | Lock answers, sync clocks, start/stop exams for all students at once |
| 💾 **Session Recovery** | Student closed their browser? Progress is saved automatically |
| 📊 **PDF Reports** | Professional performance reports generated instantly |
| 🔒 **Exam Integrity** | Prevent cheating with real-time monitoring and answer locking |
| ⚙️ **Bulk Import** | Upload 50 questions via CSV in seconds, not hours |

---

## 🎯 How It Works

```
1️⃣  Tutor creates exam + uploads questions (CSV)
2️⃣  Students join the exam session in their browser
3️⃣  Exam starts → Real-time question delivery to all students
4️⃣  Answers submitted → Automatically scored + displayed on dashboard
5️⃣  Exam ends → PDF report generated with full analytics
```

### Zero Manual Work. Zero Spreadsheets. Zero Guessing.

---

## 🚀 Quick Start

### 👨‍🏫 For Tutors (Using the Web App)

1. Clone the project
2. Follow setup below to run locally
3. Open http://localhost:5173 in your browser
4. Create an exam, add questions, invite students

### 👨‍💻 For Developers

#### 📋 Prerequisites

- **Node.js** v18+ (for frontend)
- **.NET SDK** 6.0+ (for backend)
- **SQL Server** 2019+ (database)
- **Git** (version control)

#### 🔧 Clone & Setup

```bash
# Clone the repository
git clone https://github.com/0xAhmedHassanSE/NetSupport-MVP-Project/
cd NetSupport-MVP-Project

# Backend setup
cd NetSupport-Project
dotnet restore
dotnet build
dotnet ef database update
dotnet run --launch-profile https
# Runs on https://localhost:5001 (Swagger: https://localhost:5001/swagger)

# Frontend setup (new terminal)
cd frontend-app
npm install
npm run dev
# Runs on http://localhost:5173
```

#### ✅ First Run Checklist

- [ ] 📝 Update `appsettings.json` with your SQL Server connection string
- [ ] 🗄️ Run database migrations: `dotnet ef database update`
- [ ] ✅ Backend starts without errors on https://localhost:5001
- [ ] ✅ Frontend starts without errors on http://localhost:5173
- [ ] 📚 Swagger UI loads and shows endpoints

---

## 🛠️ Under the Hood

### 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, Tailwind CSS, Axios, SignalR Client |
| **Backend** | ASP.NET Core 6, Entity Framework Core, QuestPDF |
| **Database** | SQL Server 2019+ with EF Core Migrations |
| **Real-Time** | SignalR WebSocket Hub for bidirectional communication |

### 🏗️ Architecture

The project follows a **layered architecture** pattern for clean separation of concerns:

```
NetSupport-Core/
  ├─ DTOs/               # Data transfer objects for API contracts
  ├─ Entities/           # Domain models (Student, Exam, Question, Result)
  └─ Interfaces/         # Service interfaces

NetSupport-Infrastructure/
  ├─ Services/           # Business logic (ExamService, StudentService)
  ├─ Data/               # DbContext and database configuration
  └─ Migrations/         # EF Core database schema versions

NetSupport-Project/
  ├─ Controllers/        # API endpoints (StudentsController, TutorController)
  ├─ Hubs/               # SignalR hub for real-time communication
  └─ Program.cs          # DI, middleware, CORS configuration

frontend-app/
  ├─ pages/              # Page components (StudentView, TutorDashboard)
  ├─ services/           # API client (api.js) and SignalR client (signalr.js)
  └─ src/                # UI components and styling
```

### 📡 API Reference

#### 📚 Student Endpoints (`/api/students`)
- `POST /login` — 🔐 Authenticate student, join exam session
- `GET /exam/{examId}` — 📖 Fetch exam questions
- `POST /answer` — ✍️ Submit answer and receive instant score

#### 👨‍🏫 Tutor Endpoints (`/api/tutor`)
- `GET /students` — 👥 List all connected students for current exam
- `POST /exam` — ➕ Create new exam
- `POST /exam/{examId}/start` — 🎬 Start exam for all students
- `POST /exam/{examId}/lock` — 🔒 Lock/unlock student answers
- `GET /exam/{examId}/report` — 📊 Generate PDF performance report

#### 🔄 Real-Time Events (SignalR Hub: `ClassroomHub`)
- `StudentConnected` — ➕ New student joins session
- `StudentDisconnected` — ➖ Student leaves
- `TestStarted` — 🎬 Exam begins (sent to all)
- `ReceiveLockCommand` — 🔒 Lock/unlock answers for students
- `UpdateScore` — 📈 Real-time score update to dashboard
- `SyncExamTime` — ⏱️ Synchronize exam clock across all clients

### 💾 Database Schema

Core entities:
- **Student** — Name, room, status (Active/Inactive/Completed)
- **Exam** — Title, duration, creation timestamp
- **Question** — Text, correct answer, 3 wrong options
- **ExamResult** — Student score, total questions, timestamp
- **Status** — Lookup table (Active=1, Inactive=2, Completed=3)

**Migrations:**
- `20260425163258_AddCoreEntities` — Initial schema
- `20260429174654_ChangeDurationFromIntToDouble` — Precision support for exam duration

---

## 🎮 Development Workflow

### 🖥️ Running Locally

**Terminal 1 - Backend:**
```bash
cd NetSupport-Project
dotnet run --launch-profile https
```

**Terminal 2 - Frontend:**
```bash
cd frontend-app
npm run dev
```

✨ Both support hot reload. Visit http://localhost:5173 to test.

### 🗄️ Making Database Changes

```bash
# Create a new migration
cd NetSupport-Project
dotnet ef migrations add YourMigrationName

# Apply to local database
dotnet ef database update

# Revert to previous migration (if needed)
dotnet ef database update PreviousMigrationName
```

---

## 🤝 Contributing

### 📋 Guidelines

1. **Branch naming:** `feature/your-feature` or `bugfix/issue-name`
2. **Commit format:** `feat(scope): description` or `fix(scope): description`
   - Examples: `feat(tutor): add exam timer controls`, `fix(api): handle missing exam ID`
3. **Before pushing:**
   - ▶️ Run your code locally
   - 🧪 Test key workflows (student login, exam submission, report generation)
   - ✅ Ensure no breaking changes to API contracts

### 🎨 Code Style

**C#**
- PascalCase for classes and methods
- Use async/await for I/O operations
- Follow EF Core conventions for entity configuration

**React**
- PascalCase for component names
- Use functional components with hooks
- Keep state in top-level components or services

---

