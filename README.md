# 🚀 GitStreak AI — Automated GitHub Streaks & Autonomous Project Builder

> **Maintain unbroken green contribution streaks on GitHub with realistic, AI-generated code features pushed daily at 10:00 AM IST.**

GitStreak AI is a multi-user, deployable web platform. You can host it locally or deploy it to the cloud (Render, Railway, Fly.io, VPS), give the public link to your friends, and anyone can set up automated commits for their own GitHub repositories.

---

## ✨ Features

- **🔐 GitHub OAuth Login**:
  - Sign in with your GitHub account with 1-click!
  - Automatically lists your public & private repositories in a dropdown.
  - Automatically pushes commits using your authenticated GitHub session without needing to manually generate or paste Personal Access Tokens (PAT).
- **🍃 MongoDB Atlas & Persistent Storage**:
  - Dual-adapter database supporting both **MongoDB Atlas** (cloud-persistent) and **Local Storage** fallback.
  - Simply paste your `MONGODB_URI` connection string, and GitStreak automatically switches to MongoDB with zero config!
- **🕒 Daily 10:00 AM IST Automation Engine**:
  - Automatically wakes up every day at **10:00 AM IST (Asia/Kolkata)**.
  - Inspects active campaigns and calculates the target Day `X` milestone.
- **🌐 cron-job.org Webhook Support**:
  - Dedicated webhook endpoint: `/api/cron/trigger`
  - Allows free external webcron services (like [cron-job.org](https://cron-job.org)) to wake up your server and trigger commits daily at 10:00 AM IST without keeping a local computer running.
- **🤖 Powered by Google Gemini AI**:
  - Writes actual, production-ready source code, components, tests, and documentation adhering strictly to the day's project milestone (no fake empty commits!).
  - Partitions each day's deliverables into `N` semantic commits with Conventional Commit messages (`feat: ...`, `refactor: ...`, `test: ...`, `docs: ...`).
- **👥 Multi-User & Shareable**:
  - Each friend has isolated project campaigns and activity logs.
- **✨ One-Click AI Roadmap Auto-Planner**:
  - Don't have a 30-day plan? Click **"✨ Auto-Plan with Gemini AI"** and Gemini will generate a full day-by-day technical development plan!
- **⚡ Instant "Run Today's Commit" Trigger**:
  - Test or trigger any day's commit instantly with one click directly from the dashboard.
- **📊 Real-Time Dashboard & Terminal**:
  - Live IST time display with countdown.
  - Visual 30-day green heatmap simulator.
  - Live streaming execution console and direct clickable GitHub commit links.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, `node-cron`, `jsonwebtoken`, `cookie-parser`
- **Database**: MongoDB (Mongoose) with automatic Local Persistent Storage fallback
- **Authentication**: GitHub OAuth 2.0 with JWT Sessions
- **GitHub Integration**: `@octokit/rest` (uses GitHub Git Data API: blobs, trees, and commit references; zero local git cloning overhead)
- **AI Engine**: Google Gemini API (`gemini-3.8-flash`, `gemini-3.0-flash`, `gemini-2.0-flash`, `gemini-1.5-flash` with dynamic model discovery)
- **Frontend**: Vanilla HTML5, Modern CSS (Glassmorphism, Dark Mode, Glowing Emerald Accents), Vanilla JS

---

## 🚀 Quick Start (Local)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🔑 Required Credentials

### 1. GitHub Personal Access Token (PAT)
The software needs permission to push commits to the user's repository:
1. Go to [GitHub Settings -> Developer Settings -> Personal Access Tokens -> Tokens (classic)](https://github.com/settings/tokens/new).
2. Note: `GitStreak Automation`.
3. Check the **`repo`** checkbox (Full control of private repositories).
4. Click **Generate token** and copy the string (e.g., `ghp_...`).

### 2. Google Gemini API Key
Used to generate the code files and commit roadmap:
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key** (it is free).
3. Paste it into the GitStreak UI or set `GEMINI_API_KEY` in `.env`.

---

## ⚡ Standalone GitHub Actions Setup (Recommended — 100% Free & Serverless)

You can run GitStreak directly inside GitHub Actions with **zero servers, zero hosting costs, and no sleep issues**:

1. **Enable Workflow Write Permissions**:
   - In your GitHub repo, go to **Settings** → **Actions** → **General**.
   - Under **Workflow permissions**, choose **"Read and write permissions"** and check **"Allow GitHub Actions to create and approve pull requests"**.
   - Click **Save**.

2. **Add Gemini API Key Secret** *(Optional but recommended)*:
   - In your GitHub repo, go to **Settings** → **Secrets and variables** → **Actions**.
   - Click **New repository secret**.
   - Name: `GEMINI_API_KEY`
   - Value: Your key from [Google AI Studio](https://aistudio.google.com/app/apikey).
   *(Note: Even without a key, GitStreak's built-in autonomous resilient code generator will craft realistic milestone code and tests to preserve your streak!)*

3. **Run or Schedule**:
   - The workflow runs automatically every day at **10:00 AM IST (10:00 IST / 04:30 UTC)**.
   - You can also trigger it manually anytime by going to the **Actions** tab on GitHub → select **GitStreak Daily Automation** → click **Run workflow**!

---

## 🌐 Deploying to the Cloud (Web Dashboard Version)

When deployed to a cloud server, the cron job runs continuously even when your laptop is closed.

### Option A: Deploy on Render (Recommended & Free)
1. Push this folder to your GitHub account as a private or public repository.
2. Sign in to [Render.com](https://render.com) and click **New Web Service**.
3. Connect your repository.
4. Render will automatically detect the settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click **Deploy Web Service**!
6. Once deployed, share the `.onrender.com` link with your friends!

### Option B: Deploy with Docker
```bash
docker build -t gitstreak-ai .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name gitstreak gitstreak-ai
```

---

## 📂 Project Structure

```
├── server/
│   ├── index.js          # Express REST API & static file server
│   ├── scheduler.js      # node-cron scheduler (10:00 AM IST daily trigger)
│   ├── gemini.js         # Gemini API code generator & auto-planner
│   ├── github.js         # GitHub Octokit API integration (commits, trees, branches)
│   ├── streakRunner.js   # Execution orchestrator for daily streak jobs
│   └── db.js             # Atomic persistent JSON database
├── public/
│   ├── index.html        # Modern dashboard & interactive modals
│   ├── css/style.css     # Dark mode glassmorphism & responsive design
│   └── js/app.js         # UI controller, live clock, test connections
├── data/
│   └── store.json        # Persistent campaign & activity database
├── Dockerfile            # Container deployment configuration
└── render.yaml           # One-click Render deployment template
```

- [x] **Day 1**: Project setup, directory scaffolding, and environment config

- [x] **Day 2**: Data models, schema definitions, and validation helpers
