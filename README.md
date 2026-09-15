# Smart CV Matcher

## Overview

**Smart CV Matcher** is a full-stack AI web application that analyzes how well a candidate's CV matches a target Job Description.

The application compares the candidate's experience and skills against job requirements using **GPT-5-mini**, then generates structured feedback including:

* 🎯 Overall Match Score
* 📝 Executive Summary
* ✅ Key Matching Strengths
* ⚠️ Missing / Gap Skills
* 💡 Tailored Elevator Pitch

The goal is to demonstrate a practical AI-assisted workflow for recruitment and career preparation while showcasing a modern full-stack architecture.

---

## Live Demo

**Application:** https://smartcvmatcher.vercel.app

---

## Features

* Paste CV and Job Description text
* AI-powered CV vs Job Description analysis
* Match percentage scoring
* Executive summary of candidate suitability
* Key strengths identified from the CV
* Missing skills and improvement areas
* AI-generated elevator pitch
* Responsive React frontend
* FastAPI backend with structured JSON responses

---

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Vercel

### Backend

* FastAPI
* Python
* OpenAI GPT-5-mini
* Render

---

## Architecture

```text
User
   │
   ▼
React + TypeScript (Frontend)
   │
   │ POST /api/match
   ▼
FastAPI Backend
   │
   ▼
GPT-5-mini
   │
   ▼
Structured JSON Response
   │
   ▼
React Results Dashboard
```

---

## Passwordless sign-in

The app uses a six-digit email verification code. In production, Resend sends
the email and Neon hosts the PostgreSQL database. For local development, use
the explicit `EMAIL_DELIVERY_MODE=console` setting in
`backend/.env.example` to print codes in the FastAPI terminal.

Start the backend from the `backend` directory:

```bash
python -m uvicorn main:app --reload
```

The local backend creates a SQLite database named `backend/smart_cv_matcher.db`
on startup. It stores users (`user_id`, `email_address`,
`first_login_time`, and `last_login_time`) and temporary, hashed verification
codes. The database file and environment files are deliberately ignored by Git.

For the online deployment, copy the values from `backend/.env.example` into
your backend host's environment-variable dashboard. Set at least:

```text
APP_ENV=production
EMAIL_DELIVERY_MODE=resend
DATABASE_URL=<Neon PostgreSQL connection string>
RESEND_API_KEY=<Resend API key>
RESEND_FROM_EMAIL=Smart CV Matcher <login@your-verified-domain.com>
AUTH_SESSION_SECRET=<long, unique random secret>
FRONTEND_ORIGINS=https://your-frontend.example
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

The provided Neon URL may start with `postgresql://`; the backend converts it
to SQLAlchemy's `postgresql+psycopg://` format automatically. Keep Neon SSL
parameters in the copied URL. Before sending production email, verify the
sender domain in Resend; Resend requires a verified domain for sender
addresses.

Database changes are tracked with Alembic. From the project root, apply the
versioned schema with:

```bash
python -m alembic -c backend/alembic.ini upgrade head
```
