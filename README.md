# JobHunt

> All jobs. One place.

A unified job aggregation and tracking platform that removes fragmentation, eliminates duplicates, and gives you full clarity over your job search — without the noise.

---

## What It Does

- **Aggregates** jobs from Greenhouse and Lever into a single deduplicated feed
- **Scores** each job against your resume using ATS analysis (PuterJS)
- **Tracks** every application with status updates
- **Notifies** you in real-time when new matching jobs appear
- **Visualizes** your application progress with clean charts

---

## Features

| Feature | Description |
|---------|-------------|
| Unified Job Feed | Jobs from multiple sources, deduplicated via job hash |
| ATS Scoring | AI-powered match score between your resume and job requirements |
| Application Tracking | Track status: Applied, Saved, Rejected, Offer |
| Real-Time Alerts | Socket.io push notifications for new matching jobs |
| Dashboard Analytics | Daily line chart + monthly bar chart |
| Profile & Resume | Upload resume, set roles, location, skills, remote preference |
| Secure Auth | JWT + HTTP-only cookies + email verification |
| Dark / Light Mode | System-aware theme with manual toggle |

---

## Architecture

```
Browser (Next.js)
       │
       ├── TanStack Query ──► REST API (/api/*)
       ├── Socket.io ────────► WebSocket (real-time)
       └── Zustand ──────────► Local state
               │
       Express API (Node.js)
               │
       ┌───────┼──────────────────────────────┐
       │       │                              │
  PostgreSQL  Cron Jobs (daily)        External APIs
  (Prisma)        │                    ├── Greenhouse
                  ├── Fetch + Normalize ├── Lever
                  └── Deduplicate       ├── PuterJS (ATS)
                                        └── Cloudinary (files)
```

---

## Tech Stack

### Frontend (`/frontend`)
- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (component library)
- **TanStack Query v5** (server state)
- **Zustand** (global client state)
- **React Hook Form** + **Zod** (forms + validation)
- **Framer Motion** (animations)
- **react-apexcharts** (dashboard charts)
- **socket.io-client** (real-time)
- **sonner** (toast notifications)

### Backend (`/backend`)
- **Node.js 20** + **Express** + **TypeScript**
- **Prisma ORM** + **PostgreSQL** (Neon)
- **socket.io** (WebSocket server)
- **bcrypt** + **jsonwebtoken** (auth)
- **Zod** (request validation)
- **node-cron** (scheduled job aggregation)
- **Cloudinary SDK** (resume storage)
- **Nodemailer** (email verification)
- **helmet** + **express-rate-limit** + **csurf** (security)
- **Sentry** (error monitoring)

### DevOps
- **Docker** + **docker-compose** (local dev + production)
- **GitHub Actions** (CI/CD: lint → test → build → deploy)
- **Jest** + **Supertest** (backend tests)
- **Playwright** (frontend E2E tests)

---

## Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Git](https://git-scm.com)
- A [Neon](https://neon.tech) account (free PostgreSQL)
- A [Cloudinary](https://cloudinary.com) account (free file storage)
- A Gmail account (SMTP for email verification)

---

## Getting Started (Local Development)

### 1. Clone the repository

```bash
git clone https://github.com/olajuwonx/jobhunt.git
cd jobhunt
```

### 2. Set up environment variables

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

Fill in the values — see [Environment Variables](#environment-variables) below.

### 3. Start with Docker (recommended)

```bash
docker-compose up --build
```

This starts:
- `frontend` at http://localhost:3000
- `backend` at http://localhost:4000
- `postgres` at localhost:5432

### 4. Run database migrations

```bash
docker-compose exec backend npx prisma migrate dev
```

### 5. Start without Docker (alternative)

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Server
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/jobhunt

# Auth
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Sentry
SENTRY_DSN=your-sentry-dsn

# External APIs
GREENHOUSE_API_KEY=your-greenhouse-key
LEVER_API_KEY=your-lever-key

# App
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

---

## Docker Setup

### docker-compose.yml (local dev)

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: jobhunt
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    env_file: ./backend/.env
    depends_on:
      - postgres
    volumes:
      - ./backend/src:/app/src

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    env_file: ./frontend/.env.local
    depends_on:
      - backend

volumes:
  pgdata:
```

**How Docker works in this project:**
- Each service (frontend, backend, postgres) runs in its own isolated container
- Containers communicate over a shared Docker network by service name (e.g., `backend` resolves to the backend container)
- Volumes persist database data between restarts
- `--build` rebuilds images when Dockerfiles change

---

## Running Tests

### Backend tests

```bash
cd backend
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### Frontend E2E tests

```bash
cd frontend
npx playwright install    # First time only
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Interactive Playwright UI
```

---

## CI/CD Pipeline

GitHub Actions runs on every push and pull request:

```
Push / PR
    │
    ├── Lint (ESLint + TypeScript check)
    ├── Test (Jest + Playwright)
    ├── Build (Docker images)
    └── Deploy (on main branch only)
          ├── Frontend → Vercel
          └── Backend → Railway
```

Workflow file: [.github/workflows/ci.yml](.github/workflows/ci.yml)

---

## Project Phases

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | Foundation: auth, infra, Docker, CI/CD | Planned |
| Phase 2 | Job Pipeline: aggregation, deduplication, ATS scoring | Planned |
| Phase 3 | User Features: profile, tracking, dashboard, notifications | Planned |
| Phase 4 | Quality: tests, security audit, production deploy | Planned |

---

## Deployment (Zero Cost)

| Service | Platform | Cost |
|---------|----------|------|
| Frontend | [Vercel](https://vercel.com) | Free |
| Backend | [Render](https://render.com) | Free |
| Database | [Neon](https://neon.tech) | Free (512 MB) |
| Files | [Cloudinary](https://cloudinary.com) | Free (25 GB) |
| Email | Gmail SMTP | Free (500/day) |
| Monitoring | [Sentry](https://sentry.io) | Free (5k errors) |

---

## Security

- Passwords hashed with bcrypt (12 salt rounds)
- JWT stored in HTTP-only cookies (never `localStorage`)
- Email verification required before account activation
- CSRF protection on all state-changing routes
- Helmet.js for secure HTTP headers
- Rate limiting on auth and AI scoring endpoints
- Private Cloudinary URLs for resume storage
- Zod validation on every API endpoint

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: add your feature"`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

MIT
