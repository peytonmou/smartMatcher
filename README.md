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
