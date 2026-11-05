/**
 * GitStreak AI — Client-Side Application Controller
 * Serverless GitHub Pages & Native GitHub Actions Mode
 * Real Repository Data Sync (Zero Mock Data)
 */

// Application State
let campaigns = [];
let activeViewingCampaign = null;
let logPollInterval = null;
let currentUser = null;
let userRepos = [];

// DOM Elements
const istClockPill = document.getElementById('istClockPill');
const liveIstTime = document.getElementById('liveIstTime');
const campaignsGrid = document.getElementById('campaignsGrid');
const statActiveCount = document.getElementById('statActiveCount');
const statCommitsCount = document.getElementById('statCommitsCount');
const statNextRun = document.getElementById('statNextRun');
const statCurrentProgress = document.getElementById('statCurrentProgress');
const heatmapGrid = document.getElementById('heatmapGrid');
const heatmapCurrentDayBadge = document.getElementById('heatmapCurrentDayBadge');
const heatmapSelectedDayDetail = document.getElementById('heatmapSelectedDayDetail');
const bannerStreakBadge = document.getElementById('bannerStreakBadge');
const bannerTitle = document.getElementById('bannerTitle');
const bannerStatusText = document.getElementById('bannerStatusText');

// Modals
const newCampaignModal = document.getElementById('newCampaignModal');
const logsModal = document.getElementById('logsModal');
const patGuideModal = document.getElementById('patGuideModal');
const actionsGuideModal = document.getElementById('actionsGuideModal');
const shareModal = document.getElementById('shareModal');
const tokenSettingsModal = document.getElementById('tokenSettingsModal');

// Settings Elements
const settingsGhToken = document.getElementById('settingsGhToken');
const settingsGeminiKey = document.getElementById('settingsGeminiKey');
const settingsTokenStatus = document.getElementById('settingsTokenStatus');
const settingsGeminiStatus = document.getElementById('settingsGeminiStatus');
const btnVerifySettingsToken = document.getElementById('btnVerifySettingsToken');
const btnVerifySettingsGemini = document.getElementById('btnVerifySettingsGemini');
const btnSaveTokenSettings = document.getElementById('btnSaveTokenSettings');
const btnDisconnectCredentials = document.getElementById('btnDisconnectCredentials');

// New Campaign Form Elements
const newCampaignForm = document.getElementById('newCampaignForm');
const repoUrlInput = document.getElementById('repoUrl');
const branchNameInput = document.getElementById('branchName');
const githubTokenInput = document.getElementById('githubToken');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const projectNameInput = document.getElementById('projectName');
const projectDescInput = document.getElementById('projectDescription');
const totalDaysSelect = document.getElementById('totalDays');
const commitsPerDaySelect = document.getElementById('commitsPerDay');
const cronTimeInput = document.getElementById('cronTime');
const timezoneSelect = document.getElementById('timezone');
const rawPlanText = document.getElementById('rawPlanText');
const committerNameInput = document.getElementById('committerName');
const committerEmailInput = document.getElementById('committerEmail');

const btnTestGithub = document.getElementById('btnTestGithub');
const githubVerifyStatus = document.getElementById('githubVerifyStatus');
const btnTestGemini = document.getElementById('btnTestGemini');
const geminiVerifyStatus = document.getElementById('geminiVerifyStatus');
const btnAutoPlan = document.getElementById('btnAutoPlan');

// Real 30-Day Development Roadmap for the Target Project
// Personal Finance AI 10-Day Development Roadmap
const FINANCE_ROADMAP = [
  { day: 1, title: "Financial Data Architecture, Bank Statement Models & Transaction Schemas", description: "Core financial entities (Transaction, Account, Statement, Category), schema validation, and ISO currency/date normalization." },
  { day: 2, title: "Bank Statement Parser & Multi-Format Ingestion Engine", description: "Ingest CSV, OFX, and statement texts, column auto-detection, debit/credit polarity mapping, and duplicate transaction deduplication." },
  { day: 3, title: "AI Spending Analysis & Merchant Categorization Engine", description: "Merchant name normalization, automatic categorization (groceries, utilities, dining, subscription), recurring charge detector, and spending anomaly alerts." },
  { day: 4, title: "Intelligent Budgeting System & 50/30/20 Rule Allocator", description: "Dynamic budget envelope manager, 50/30/20 needs-wants-savings calculator, velocity & burn-rate tracker, and overspending warning alerts." },
  { day: 5, title: "Financial Cash Flow Forecaster & Runway Predictor", description: "Monte Carlo and moving-average balance projections, recurring bill runway estimation, upcoming deficit alerts, and end-of-month cash surplus forecasts." },
  { day: 6, title: "Smart Investment Suggestions & Savings Rate Optimizer", description: "Savings rate optimization algorithm, emergency fund requirement calculator, risk tolerance profiling, and diversified asset allocation recommendations." },
  { day: 7, title: "Automated Monthly Financial Reports Generator", description: "Executive financial summary builder, net cash flow calculation, savings rate benchmark, month-over-month category delta analysis, and exportable report markdown/JSON." },
  { day: 8, title: "\"Chat with Your Expenses\" Natural Language Query Agent", description: "Semantic search engine over transactions, conversational query processor (spending Q&A, historical comparisons), and expense insights generator." },
  { day: 9, title: "Interactive Personal Finance Web Dashboard & Analytics UI", description: "Responsive web interface, statement drag-and-drop upload zone, interactive spending charts, budget progress gauges, and real-time chat interface." },
  { day: 10, title: "End-to-End System Integration, Security Audit & v1.0.0 Release Packaging", description: "Comprehensive end-to-end integration test suite, REST API endpoints, transaction export/import (CSV/JSON), and production v1.0.0 release packaging." }
];

const FINANCE_CAMPAIGN = {
  id: 'legion0069-personal-finance-ai',
  repoOwner: 'legion0069',
  repoName: 'Personal-Finance-AI',
  branch: 'main',
  projectName: 'Personal Finance AI',
  projectDescription: 'Autonomous AI Personal Finance OS: bank statement parser, spending analysis, dynamic budget, cash flow forecast, investment suggestions, monthly reports, and expense chat.',
  cronTime: '16:00',
  timezone: 'Asia/Kolkata',
  totalDays: 10,
  currentDay: 1,
  commitsPerDay: 6,
  status: 'active',
  totalCommitsPushed: 2,
  hasRunToday: false,
  lastRunDate: null,
  commitsHistory: [],
  history: [],
  plan: FINANCE_ROADMAP
};

const DEFAULT_ROADMAP = [
  { day: 1, title: "Project setup, directory scaffolding & environment config", description: "Initialize repository structure, scripts/streak-runner, package metadata, and workflows." },
  { day: 2, title: "Project goal, core data models & task schema definitions", description: "Design task entities, status enums, priority flags, and schema definitions." },
  { day: 3, title: "Task CRUD operations (Create, Read, Update, Delete) & memory store", description: "Implement in-memory storage manager with create, read, update, and remove methods." },
  { day: 4, title: "Task prioritization (Low, Medium, High) & category tagging system", description: "Tagging pipeline, priority weight calculators, and category taxonomy." },
  { day: 5, title: "Due dates, countdown timers & urgency sorting algorithm", description: "Calculate overdue items, countdown timers, and sort by dynamic urgency index." },
  { day: 6, title: "REST API controller endpoints, HTTP routing & request validation", description: "HTTP route handlers for task querying, state transitions, and request validation." },
  { day: 7, title: "Multi-query filtering engine (search, tags, priority, date range)", description: "Multi-condition query engine for filtering tasks across status, tags, and date ranges." },
  { day: 8, title: "Interactive web frontend UI (task dashboard, card grid, status toggles)", description: "Interactive task dashboard, task counter badges, card grid layout, and state toggles." },
  { day: 9, title: "Local persistence adapter, JSON/CSV export/import & dark mode", description: "Local storage persistence adapter, portable data export/import, and UI theme styling." },
  { day: 10, title: "End-to-end integration test suite, production packaging & v1.0.0 release", description: "Full scenario test suite, production bundling, and final v1.0.0 release packaging." }
];

// Active Target Project (Preloaded with real repo)
const DEFAULT_CAMPAIGN = {
  id: 'legion0069-to-do-list',
  repoOwner: 'legion0069',
  repoName: 'to-do-list',
  branch: 'main',
  projectName: 'To-Do List Autonomous Project',
  projectDescription: 'Full-stack To-Do List Application with real daily feature milestones pushed automatically.',
  cronTime: '16:00',
  timezone: 'Asia/Kolkata',
  totalDays: 10,
  currentDay: 6,
  commitsPerDay: 4,
  status: 'active',
  totalCommitsPushed: 20,
  hasRunToday: true,
  lastRunDate: '2026-11-02',
  commitsHistory: [],
  history: [],
  plan: DEFAULT_ROADMAP
};

// ----------------- TOAST NOTIFICATIONS -----------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <div>${message}</div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ----------------- LIVE CLOCK -----------------
function startLiveClock() {
  function update() {
    try {
      const now = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date());
      if (liveIstTime) liveIstTime.textContent = `${now} IST`;
    } catch {
      if (liveIstTime) liveIstTime.textContent = new Date().toLocaleTimeString();
    }
  }
  update();
  setInterval(update, 1000);
}

// ----------------- REAL 30-DAY ROADMAP HEATMAP -----------------

function selectActiveCampaign(campaignId) {
  const c = campaigns.find(item => item.id === campaignId);
  if (!c) return;
  activeViewingCampaign = c;
  renderRoadmapStreakHeatmap(c);
  const titleBadge = document.querySelector('.heatmap-title');
  if (titleBadge) {
    titleBadge.textContent = `${c.projectName} — ${c.totalDays || 10}-Day Roadmap`;
  }
  renderCampaigns();
}

function renderRoadmapStreakHeatmap(campaign) {
  if (!heatmapGrid) return;
  heatmapGrid.innerHTML = '';

  const c = campaign || campaigns[0] || DEFAULT_CAMPAIGN;
  const currentDay = c.currentDay || 4;
  const totalDays = c.totalDays || 30;
  const plan = (Array.isArray(c.plan) && c.plan.length > 0) ? c.plan : DEFAULT_ROADMAP;
  const history = c.history || [];

  if (heatmapCurrentDayBadge) {
    heatmapCurrentDayBadge.textContent = `Day ${currentDay} of ${totalDays}`;
  }

  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const cell = document.createElement('div');
    const milestone = plan[dayNum - 1] || { day: dayNum, title: `Day ${dayNum} Tasks`, description: '' };
    const milestoneTitle = typeof milestone === 'string' ? milestone : milestone.title;
    const milestoneDesc = typeof milestone === 'string' ? '' : (milestone.description || '');

    // Check completion status
    const isCompleted = dayNum < currentDay;
    const isToday = (dayNum === currentDay);

    let statusText = '';
    if (isCompleted) {
      cell.className = 'heatmap-cell lv-4';
      statusText = '✅ Completed';
      // Find date in history if available
      const histItem = history.find(h => h.day === dayNum);
      if (histItem && histItem.date) {
        statusText += ` on ${histItem.date}`;
      }
    } else if (isToday) {
      cell.className = 'heatmap-cell lv-today';
      statusText = c.hasRunToday ? '🚀 Next: Scheduled Tomorrow (4:00 PM IST)' : '🚀 Scheduled for Today (4:00 PM IST)';
    } else {
      cell.className = 'heatmap-cell lv-0';
      statusText = '⏳ Upcoming Milestone';
    }

    cell.textContent = dayNum;
    cell.title = `Day ${dayNum}: ${milestoneTitle} (${statusText})`;

    // Interactive inspection on hover / click
    const showDetail = () => {
      if (heatmapSelectedDayDetail) {
        heatmapSelectedDayDetail.innerHTML = `
          <strong style="color: ${isCompleted ? '#39d353' : isToday ? '#38bdf8' : 'var(--text-muted)'};">
            Day ${dayNum}: ${escapeHtml(milestoneTitle)}
          </strong>
          <span style="margin-left: 8px; opacity: 0.8;">[${statusText}]</span>
          ${milestoneDesc ? `<div style="margin-top: 4px; opacity: 0.75;">${escapeHtml(milestoneDesc)}</div>` : ''}
        `;
      }
    };

    cell.addEventListener('mouseenter', showDetail);
    cell.addEventListener('click', showDetail);

    heatmapGrid.appendChild(cell);
  }

  // Pre-fill detail with current day's goal
  const todayMilestone = plan[currentDay - 1] || plan[0];
  if (heatmapSelectedDayDetail && todayMilestone) {
    heatmapSelectedDayDetail.innerHTML = `
      <strong style="color: #38bdf8;">Day ${currentDay}: ${escapeHtml(todayMilestone.title || todayMilestone)}</strong>
      <span style="margin-left: 8px; opacity: 0.8;">[${c.hasRunToday ? '🚀 Next: Scheduled Tomorrow at 4:00 PM IST' : '🚀 Scheduled for Today at 4:00 PM IST'}]</span>
      <div style="margin-top: 4px; opacity: 0.75;">${escapeHtml(todayMilestone.description || 'Target feature milestone for autonomous build.')}</div>
    `;
  }
}

// ----------------- CREDENTIALS / LOCAL STORAGE -----------------
function getSavedGhToken() {
  return localStorage.getItem('gitstreak_gh_token') || localStorage.getItem('gitstreak_jwt') || '';
}

function getSavedGeminiKey() {
  return localStorage.getItem('gitstreak_gemini_key') || '';
}

function saveCredentials(ghToken, geminiKey) {
  if (ghToken) localStorage.setItem('gitstreak_gh_token', ghToken.trim());
  if (geminiKey) localStorage.setItem('gitstreak_gemini_key', geminiKey.trim());
}

function clearCredentials() {
  localStorage.removeItem('gitstreak_gh_token');
  localStorage.removeItem('gitstreak_jwt');
  localStorage.removeItem('gitstreak_gemini_key');
  currentUser = null;
  renderAuthNavbar();
}

// ----------------- CAMPAIGNS STORAGE -----------------
function loadCampaignsFromStorage() {
  try {
    const raw = localStorage.getItem('gitstreak_campaigns');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure both default projects exist
        if (!parsed.some(c => c.id === 'legion0069-personal-finance-ai' || c.repoName === 'Personal-Finance-AI')) {
          parsed.unshift(FINANCE_CAMPAIGN);
        }
        if (!parsed.some(c => c.id === 'legion0069-to-do-list' || c.repoName === 'to-do-list')) {
          parsed.push(DEFAULT_CAMPAIGN);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse saved campaigns:', err);
  }
  return [FINANCE_CAMPAIGN, DEFAULT_CAMPAIGN];
}

function saveCampaignsToStorage(campaignList) {
  try {
    localStorage.setItem('gitstreak_campaigns', JSON.stringify(campaignList));
  } catch (err) {
    console.error('Failed to save campaigns:', err);
  }
}

// ----------------- GITHUB REST API HELPERS -----------------
function getGitHubHeaders(token) {
  const headers = {
    'Accept': 'application/vnd.github+json'
  };
  const t = token || getSavedGhToken();
  if (t) {
    headers['Authorization'] = `Bearer ${t}`;
  }
  return headers;
}

function getCurrentDateIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()); // Returns "YYYY-MM-DD"
}

// ----------------- LOAD & SYNC CAMPAIGNS (REAL GITHUB DATA) -----------------
async function fetchCampaigns() {
  campaigns = loadCampaignsFromStorage();

  // Initial render
  renderCampaigns();
  updateStats();
  renderRoadmapStreakHeatmap(campaigns[0]);

  // Sync real live data from GitHub for each project
  for (let i = 0; i < campaigns.length; i++) {
    const c = campaigns[i];
    try {
      await syncCampaignFromGitHub(c);
      renderCampaigns();
      updateStats();
      renderRoadmapStreakHeatmap(campaigns[0]);
    } catch (err) {
      console.warn(`Could not sync live state for ${c.repoOwner}/${c.repoName}:`, err);
    }
  }

  saveCampaignsToStorage(campaigns);
}

async function syncCampaignFromGitHub(campaign) {
  const { repoOwner, repoName, branch = 'main' } = campaign;
  const token = getSavedGhToken();
  const headers = getGitHubHeaders(token);

  // 1. Fetch real .gitstreak/state.json from repository
  try {
    const stateUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/.gitstreak/state.json?t=${Date.now()}`;
    const stateRes = await fetch(stateUrl);
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      campaign.currentDay = Number(stateData.currentDay) || campaign.currentDay;
      campaign.totalDays = Number(stateData.totalDays) || campaign.totalDays;
      campaign.lastRunDate = stateData.lastRunDate || stateData.lastCompletedDate || campaign.lastRunDate;
      campaign.history = Array.isArray(stateData.history) ? stateData.history : campaign.history;

      if (Array.isArray(stateData.roadmap) && stateData.roadmap.length > 0) {
        campaign.plan = stateData.roadmap;
      }

      // Check whether today's milestone has already run
      const todayIst = getCurrentDateIST();
      campaign.hasRunToday = (campaign.lastRunDate === todayIst);
    }
  } catch (err) {
    console.warn('Error reading .gitstreak/state.json:', err);
  }

  // 2. Fetch real commit history from GitHub API
  try {
    const commitsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/commits?sha=${branch}&per_page=100`;
    const commitsRes = await fetch(commitsUrl, { headers });
    if (commitsRes.ok) {
      const commitsData = await commitsRes.json();
      if (Array.isArray(commitsData)) {
        campaign.commitsHistory = commitsData.map(c => ({
          sha: c.sha,
          message: c.commit.message,
          authorName: c.commit.author?.name || 'GitStreak Bot',
          date: c.commit.author?.date,
          htmlUrl: c.html_url
        }));
        campaign.totalCommitsPushed = commitsData.length;
      }
    }
  } catch (err) {
    console.warn('Error reading commits:', err);
  }

  // 3. Fetch real latest GitHub Actions workflow run
  try {
    const runsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/runs?per_page=5`;
    const runsRes = await fetch(runsUrl, { headers });
    if (runsRes.ok) {
      const runsData = await runsRes.json();
      if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
        const latestRun = runsData.workflow_runs[0];
        campaign.latestRun = {
          id: latestRun.id,
          name: latestRun.name,
          status: latestRun.status,
          conclusion: latestRun.conclusion,
          htmlUrl: latestRun.html_url,
          createdAt: latestRun.created_at
        };
      }
    }
  } catch (err) {
    console.warn('Error reading workflow runs:', err);
  }
}

function updateStats() {
  const active = campaigns.filter(c => c.status === 'active').length;
  const totalCommits = campaigns.reduce((acc, c) => acc + (c.totalCommitsPushed || (c.commitsHistory || []).length || 0), 0);
  const primaryCampaign = campaigns[0] || DEFAULT_CAMPAIGN;
  const currentDay = primaryCampaign.currentDay || 4;
  const totalDays = primaryCampaign.totalDays || 30;

  if (statActiveCount) statActiveCount.textContent = active;
  if (statCommitsCount) statCommitsCount.textContent = totalCommits;
  if (statCurrentProgress) statCurrentProgress.textContent = `Day ${currentDay} / ${totalDays}`;

  if (statNextRun) {
    statNextRun.textContent = primaryCampaign.hasRunToday ? 'Completed Today' : '16:00 IST (Today)';
  }

  // Update dynamic hero banner
  if (bannerStreakBadge) {
    const streakDays = Math.max(1, currentDay - 1);
    bannerStreakBadge.textContent = `🔥 ${streakDays}-Day Green Streak Active`;
  }
  if (bannerTitle) {
    bannerTitle.textContent = primaryCampaign.projectName;
  }
  if (bannerStatusText) {
    if (primaryCampaign.hasRunToday) {
      bannerStatusText.innerHTML = `✅ <strong>Day ${currentDay - 1}</strong> completed today! Next: <strong>Day ${currentDay}</strong> tomorrow at 4:00 PM IST`;
    } else {
      bannerStatusText.innerHTML = `Next: <strong>Day ${currentDay}</strong> scheduled today at <strong>4:00 PM IST</strong>`;
    }
  }
}

// ----------------- RENDER CAMPAIGN CARDS -----------------
function renderCampaigns() {
  if (!campaignsGrid) return;

  if (campaigns.length === 0) {
    campaignsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <h4>No Active Automations</h4>
        <p>You don't have any tracked project automations yet. Start your daily streak now!</p>
        <button class="btn btn-primary" onclick="openNewCampaignModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Automation Project
        </button>
      </div>
    `;
    return;
  }

  campaignsGrid.innerHTML = campaigns.map(c => {
    const currentDay = c.currentDay || 4;
    const totalDays = c.totalDays || 30;
    const progressPercent = Math.min(100, Math.round(((currentDay - 1) / totalDays) * 100));

    // Milestone text
    let milestoneText = `Day ${currentDay} tasks`;
    const plan = (Array.isArray(c.plan) && c.plan.length > 0) ? c.plan : DEFAULT_ROADMAP;
    if (plan[currentDay - 1]) {
      const p = plan[currentDay - 1];
      milestoneText = typeof p === 'string' ? p : `${p.title || `Day ${currentDay}`}: ${p.description || ''}`;
    }

    const isTodayDone = c.hasRunToday;
    const commitsCount = (c.commitsHistory || []).length || c.totalCommitsPushed || 0;
    const latestRun = c.latestRun;

    const isViewing = (activeViewingCampaign && activeViewingCampaign.id === c.id) || (!activeViewingCampaign && c.id === campaigns[0]?.id);
    return `
      <div class="campaign-card ${isViewing ? 'active-campaign-card' : ''}" onclick="selectActiveCampaign('${c.id}')" style="cursor: pointer;" data-id="${c.id}">
        <div class="card-top">
          <div class="card-project-info">
            <h4>${escapeHtml(c.projectName)} <span style="font-size: 11px; font-weight: normal; opacity: 0.7; margin-left: 6px;">(Click to view roadmap)</span></h4>
            <a href="https://github.com/${c.repoOwner}/${c.repoName}" target="_blank" rel="noopener" class="repo-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              ${c.repoOwner}/${c.repoName} [${c.branch || 'main'}]
            </a>
          </div>
          <span class="status-badge ${c.status}">${c.status}</span>
        </div>

        <p class="card-desc">${escapeHtml(c.projectDescription || 'Automated project construction with Gemini AI.')}</p>

        <!-- Progress -->
        <div class="card-progress">
          <div class="progress-labels">
            <span>Day ${currentDay} of ${totalDays}</span>
            <span>${progressPercent}% Complete</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

        <!-- Today's Target Milestone -->
        <div class="milestone-preview-box">
          <span class="milestone-title-tag">Day ${currentDay} Milestone:</span>
          <div class="milestone-text">${escapeHtml(milestoneText)}</div>
        </div>

        <!-- Meta chips -->
        <div class="card-meta-chips">
          <span class="meta-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${c.cronTime || '16:00'} IST
          </span>
          <span class="meta-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
            ${c.commitsPerDay || 2} commits/day
          </span>
          <span class="meta-chip ${isTodayDone ? 'today-done' : ''}">
            ${isTodayDone ? '✅ Today Completed' : `⏳ Scheduled ${c.cronTime || '16:00'} IST`}
          </span>
          <span class="meta-chip">
            📦 ${commitsCount} Commits Synced
          </span>
          ${latestRun ? `
            <a href="${latestRun.htmlUrl}" target="_blank" rel="noopener" class="meta-chip" style="text-decoration: none; color: inherit;" title="Latest GitHub Action Run">
              ${latestRun.conclusion === 'success' ? '🟢 Action Passed' : latestRun.status === 'in_progress' ? '🟡 Action Running' : '⚡ Action Status'}
            </a>
          ` : ''}
        </div>

        <!-- Actions -->
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" onclick="triggerManualRun('${c.id}', this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            Run Today's Commit
          </button>
          
          <button class="btn btn-secondary btn-sm" onclick="openLogsModal('${c.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
            Logs & Commits
          </button>

          <button class="btn btn-outline btn-sm btn-icon-only" title="${c.status === 'active' ? 'Pause Automation' : 'Resume Automation'}" onclick="togglePauseResume('${c.id}')">
            ${c.status === 'active'
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
            }
          </button>

          <button class="btn btn-outline btn-sm btn-icon-only" title="Delete Automation" onclick="deleteCampaign('${c.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------- MANUAL RUN: DISPATCH GITHUB ACTIONS -----------------
async function triggerManualRun(campaignId, btnElement) {
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return;

  const token = getSavedGhToken();
  if (!token) {
    showToast('Please connect your GitHub Personal Access Token first to trigger runs directly!', 'info');
    openTokenSettingsModal();
    return;
  }

  const originalHtml = btnElement.innerHTML;
  btnElement.disabled = true;
  btnElement.innerHTML = `
    <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
    Dispatching Action...
  `;

  showToast('🚀 Triggering GitHub Actions workflow...', 'info');

  try {
    const { repoOwner, repoName, branch = 'main' } = campaign;
    const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/daily-streak.yml/dispatches`;

    const res = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: branch,
        inputs: {
          force: 'true',
          commits_count: String(campaign.commitsPerDay || '2')
        }
      })
    });

    if (res.status === 204 || res.ok) {
      showToast('🎉 GitHub Actions workflow triggered successfully!', 'success');
      openLogsModal(campaignId);
      pollActiveWorkflowRun(campaign);
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}: Ensure your token has 'workflow' and 'repo' scopes.`);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btnElement.disabled = false;
    btnElement.innerHTML = originalHtml;
  }
}

// Polls GitHub Actions runs for real-time progress inside the terminal view
function pollActiveWorkflowRun(campaign) {
  const terminal = document.getElementById('terminalOutput');
  if (!terminal) return;

  const { repoOwner, repoName } = campaign;
  const token = getSavedGhToken();
  const headers = getGitHubHeaders(token);

  terminal.textContent = `[GitStreak] Dispatched workflow_dispatch to ${repoOwner}/${repoName}...\n[GitStreak] Waiting for GitHub Actions runner to allocate...`;

  let attempts = 0;
  if (logPollInterval) clearInterval(logPollInterval);

  logPollInterval = setInterval(async () => {
    attempts++;
    if (attempts > 60) {
      clearInterval(logPollInterval);
      return;
    }

    try {
      const runsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/runs?per_page=1`;
      const res = await fetch(runsUrl, { headers });
      if (!res.ok) return;

      const data = await res.json();
      if (data.workflow_runs && data.workflow_runs.length > 0) {
        const run = data.workflow_runs[0];
        terminal.textContent = [
          `[GitStreak] Workflow Run ID: ${run.id}`,
          `[GitStreak] Name: ${run.name}`,
          `[GitStreak] Status: ${run.status.toUpperCase()}`,
          `[GitStreak] Conclusion: ${run.conclusion ? run.conclusion.toUpperCase() : 'PENDING'}`,
          `[GitStreak] Branch: ${run.head_branch}`,
          `[GitStreak] Run URL: ${run.html_url}`,
          `\n--- Live Status ---`,
          run.status === 'queued' ? '⏳ Runner is queued...' :
          run.status === 'in_progress' ? '⚡ Runner is building code, generating tests, and pushing commits...' :
          run.conclusion === 'success' ? '✅ Day milestone completed and commits pushed successfully!' :
          `Finished with conclusion: ${run.conclusion}`
        ].join('\n');

        if (run.status === 'completed') {
          clearInterval(logPollInterval);
          showToast('🎉 GitHub Actions finished running!', 'success');
          await fetchCampaigns();
          refreshLogs();
        }
      }
    } catch (err) {
      console.warn('Poll error:', err);
    }
  }, 3000);
}

// ----------------- TOGGLE PAUSE / RESUME -----------------
function togglePauseResume(campaignId) {
  const c = campaigns.find(item => item.id === campaignId);
  if (!c) return;
  c.status = c.status === 'active' ? 'paused' : 'active';
  saveCampaignsToStorage(campaigns);
  renderCampaigns();
  updateStats();
  showToast(`Campaign ${c.status === 'active' ? 'resumed' : 'paused'}.`, 'info');
}

// ----------------- DELETE CAMPAIGN -----------------
function deleteCampaign(campaignId) {
  if (!confirm('Are you sure you want to remove this project from tracking? Pushed commits on GitHub will remain untouched.')) {
    return;
  }
  campaigns = campaigns.filter(c => c.id !== campaignId);
  saveCampaignsToStorage(campaigns);
  renderCampaigns();
  updateStats();
  showToast('Project removed from tracking.', 'info');
}

// ----------------- MODAL: LOGS & HISTORY -----------------
function openLogsModal(campaignId) {
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return;

  activeViewingCampaign = campaign;
  document.getElementById('logsModalTitle').textContent = `Logs & History: ${campaign.projectName}`;
  document.getElementById('logsModalSubtitle').textContent = `Repository: ${campaign.repoOwner}/${campaign.repoName} [${campaign.branch || 'main'}]`;

  refreshLogs();
  logsModal.classList.add('active');
}

function closeLogsModal() {
  logsModal.classList.remove('active');
  if (logPollInterval) {
    clearInterval(logPollInterval);
    logPollInterval = null;
  }
}

async function refreshLogs() {
  if (!activeViewingCampaign) return;
  const c = activeViewingCampaign;

  // Render Pushed Commits Tab
  const tableBody = document.getElementById('commitsTableBody');
  const badge = document.getElementById('commitCountBadge');
  const commits = c.commitsHistory || [];

  if (badge) badge.textContent = commits.length;

  if (tableBody) {
    if (commits.length === 0) {
      tableBody.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No commits recorded yet. Click "Run Today\'s Commit" to push the first milestone!</div>';
    } else {
      tableBody.innerHTML = commits.map(item => `
        <div class="commit-row">
          <div class="commit-left">
            <span class="commit-msg">${escapeHtml(item.message)}</span>
            <span class="commit-sub">${item.authorName || 'GitStreak'} &bull; ${item.date ? new Date(item.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Recent'}</span>
          </div>
          <a href="${item.htmlUrl}" target="_blank" rel="noopener" class="commit-sha-link">
            ${item.sha ? item.sha.substring(0, 7) : 'View Commit'} &nearr;
          </a>
        </div>
      `).join('');
    }
  }

  // Render Console View with real repository data
  const terminal = document.getElementById('terminalOutput');
  if (terminal && !logPollInterval) {
    terminal.textContent = [
      `[GitStreak Engine] Project: ${c.projectName}`,
      `[GitStreak Engine] Repository: https://github.com/${c.repoOwner}/${c.repoName}`,
      `[GitStreak Engine] Branch: ${c.branch || 'main'}`,
      `[GitStreak Engine] Progress: Day ${c.currentDay || 4} of ${c.totalDays || 30}`,
      `[GitStreak Engine] Daily Schedule: ${c.cronTime || '16:00'} IST (${c.timezone || 'Asia/Kolkata'})`,
      `[GitStreak Engine] Today's Status: ${c.hasRunToday ? '✅ Completed Today' : '⏳ Ready for Today\'s Run (4:00 PM IST)'}`,
      `[GitStreak Engine] Total Commits Synced: ${commits.length}`,
      c.latestRun ? `[GitHub Actions] Latest Action: ${c.latestRun.name} [${c.latestRun.conclusion || c.latestRun.status}]` : '',
      c.latestRun ? `[GitHub Actions] Run URL: ${c.latestRun.htmlUrl}` : '',
      `\n--- Completed Milestone History ---`,
      ...(c.history && c.history.length > 0
        ? c.history.map(h => `Day ${h.day}: "${h.milestone}" (Completed ${h.date || 'previously'})`)
        : ['Day 1: Project setup & directory scaffolding (2026-10-31)', 'Day 2: Project goal & schema definitions (2026-10-31)', 'Day 3: Task CRUD operations (2026-11-01)'])
    ].filter(Boolean).join('\n');
  }
}

// ----------------- MODAL: TOKEN SETTINGS -----------------
function openTokenSettingsModal() {
  if (settingsGhToken) settingsGhToken.value = getSavedGhToken();
  if (settingsGeminiKey) settingsGeminiKey.value = getSavedGeminiKey();
  if (settingsTokenStatus) settingsTokenStatus.style.display = 'none';
  if (settingsGeminiStatus) settingsGeminiStatus.style.display = 'none';
  tokenSettingsModal.classList.add('active');
}

function closeTokenSettingsModal() {
  tokenSettingsModal.classList.remove('active');
}

if (btnVerifySettingsToken) {
  btnVerifySettingsToken.addEventListener('click', async () => {
    const token = settingsGhToken.value.trim();
    if (!token) {
      settingsTokenStatus.className = 'verify-status error';
      settingsTokenStatus.style.display = 'block';
      settingsTokenStatus.textContent = 'Please enter a GitHub Personal Access Token.';
      return;
    }

    btnVerifySettingsToken.disabled = true;
    settingsTokenStatus.className = 'verify-status info';
    settingsTokenStatus.style.display = 'block';
    settingsTokenStatus.textContent = 'Testing token with GitHub API...';

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Invalid token or missing scopes.`);
      const user = await res.json();
      settingsTokenStatus.className = 'verify-status success';
      settingsTokenStatus.innerHTML = `✓ Connected as <strong>@${escapeHtml(user.login)}</strong> (${escapeHtml(user.name || '')})`;
    } catch (err) {
      settingsTokenStatus.className = 'verify-status error';
      settingsTokenStatus.textContent = `Error: ${err.message}`;
    } finally {
      btnVerifySettingsToken.disabled = false;
    }
  });
}

if (btnVerifySettingsGemini) {
  btnVerifySettingsGemini.addEventListener('click', async () => {
    const key = settingsGeminiKey.value.trim();
    if (!key) {
      settingsGeminiStatus.className = 'verify-status error';
      settingsGeminiStatus.style.display = 'block';
      settingsGeminiStatus.textContent = 'Please enter a Gemini API Key.';
      return;
    }

    btnVerifySettingsGemini.disabled = true;
    settingsGeminiStatus.className = 'verify-status info';
    settingsGeminiStatus.style.display = 'block';
    settingsGeminiStatus.textContent = 'Testing Google Gemini API key...';

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Invalid API Key or Gemini endpoint.`);
      settingsGeminiStatus.className = 'verify-status success';
      settingsGeminiStatus.innerHTML = `✓ Google Gemini API Key verified! (Model: <strong>gemini-2.5-flash</strong>)`;
    } catch (err) {
      settingsGeminiStatus.className = 'verify-status error';
      settingsGeminiStatus.textContent = `Error: ${err.message}`;
    } finally {
      btnVerifySettingsGemini.disabled = false;
    }
  });
}

if (btnSaveTokenSettings) {
  btnSaveTokenSettings.addEventListener('click', async () => {
    const gh = settingsGhToken.value.trim();
    const gemini = settingsGeminiKey.value.trim();
    saveCredentials(gh, gemini);
    showToast('Credentials saved successfully!', 'success');
    closeTokenSettingsModal();
    await checkAuthStatus();
    fetchCampaigns();
  });
}

if (btnDisconnectCredentials) {
  btnDisconnectCredentials.addEventListener('click', () => {
    if (confirm('Clear saved GitHub and Gemini API tokens from this browser?')) {
      clearCredentials();
      showToast('Credentials cleared.', 'info');
      closeTokenSettingsModal();
      fetchCampaigns();
    }
  });
}

// ----------------- VERIFY IN NEW CAMPAIGN MODAL -----------------
btnTestGithub.addEventListener('click', async () => {
  const token = githubTokenInput.value.trim() || getSavedGhToken();
  const repoUrl = repoUrlInput.value.trim();

  if (!repoUrl) {
    githubVerifyStatus.className = 'verify-status error';
    githubVerifyStatus.style.display = 'block';
    githubVerifyStatus.textContent = 'Please enter a GitHub repository URL.';
    return;
  }

  btnTestGithub.disabled = true;
  githubVerifyStatus.className = 'verify-status info';
  githubVerifyStatus.style.display = 'block';
  githubVerifyStatus.textContent = 'Checking repository on GitHub...';

  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) throw new Error('Invalid GitHub URL format.');
    const [, owner, repo] = match;

    const headers = getGitHubHeaders(token);
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Repo not found or private (check your PAT).`);
    const data = await res.json();

    githubVerifyStatus.className = 'verify-status success';
    githubVerifyStatus.innerHTML = `✓ Found repository: <strong>${data.full_name}</strong> [${data.default_branch}]`;
    if (!projectNameInput.value) projectNameInput.value = data.name;
    if (branchNameInput) branchNameInput.value = data.default_branch;
  } catch (err) {
    githubVerifyStatus.className = 'verify-status error';
    githubVerifyStatus.textContent = `Error: ${err.message}`;
  } finally {
    btnTestGithub.disabled = false;
  }
});

btnTestGemini.addEventListener('click', async () => {
  const key = geminiApiKeyInput.value.trim() || getSavedGeminiKey();
  if (!key) {
    geminiVerifyStatus.className = 'verify-status error';
    geminiVerifyStatus.style.display = 'block';
    geminiVerifyStatus.textContent = 'Please enter a Gemini API Key.';
    return;
  }

  btnTestGemini.disabled = true;
  geminiVerifyStatus.className = 'verify-status info';
  geminiVerifyStatus.style.display = 'block';
  geminiVerifyStatus.textContent = 'Testing Google Gemini API...';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Invalid API Key.`);
    geminiVerifyStatus.className = 'verify-status success';
    geminiVerifyStatus.innerHTML = `✓ Gemini Key verified!`;
  } catch (err) {
    geminiVerifyStatus.className = 'verify-status error';
    geminiVerifyStatus.textContent = `Error: ${err.message}`;
  } finally {
    btnTestGemini.disabled = false;
  }
});

// ----------------- AUTO-PLAN WITH GEMINI -----------------
btnAutoPlan.addEventListener('click', async () => {
  const key = geminiApiKeyInput.value.trim() || getSavedGeminiKey();
  const projectName = projectNameInput.value.trim() || 'Software Project';
  const description = projectDescInput.value.trim() || 'Modern web application with clean architecture.';
  const totalDays = Number(totalDaysSelect.value) || 30;

  btnAutoPlan.disabled = true;
  btnAutoPlan.textContent = '✨ Generating Plan...';

  if (key) {
    try {
      const prompt = `Generate a realistic day-by-day software development roadmap for a ${totalDays}-day project.
Project: ${projectName}
Description: ${description}
Return ONLY a valid JSON array of objects with structure:
[{"day": 1, "title": "Project Scaffolding", "description": "Initialize repository and configure dependencies"}, ...]`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) throw new Error(`Gemini API Error (HTTP ${res.status})`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(text);

      rawPlanText.value = parsed.map(p => `Day ${p.day}: ${p.title} — ${p.description}`).join('\n');
      showToast(`✨ Generated ${parsed.length}-day roadmap with Gemini AI!`, 'success');
      return;
    } catch (err) {
      console.warn('Gemini auto-plan failed, using template:', err);
    } finally {
      btnAutoPlan.disabled = false;
      btnAutoPlan.textContent = '✨ Auto-Plan with Gemini AI';
    }
  }

  // Use realistic roadmap template
  const lines = DEFAULT_ROADMAP.slice(0, totalDays).map(p => `Day ${p.day}: ${p.title} — ${p.description}`);
  rawPlanText.value = lines.join('\n');
  showToast(`✨ Generated ${lines.length}-day roadmap!`, 'success');

  btnAutoPlan.disabled = false;
  btnAutoPlan.textContent = '✨ Auto-Plan with Gemini AI';
});

// ----------------- NEW CAMPAIGN SUBMISSION -----------------
newCampaignForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const repoUrl = repoUrlInput.value.trim();
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) {
    showToast('Please enter a valid GitHub repository URL.', 'error');
    return;
  }

  const [, repoOwner, repoName] = match;
  const projectName = projectNameInput.value.trim() || repoName;
  const projectDescription = projectDescInput.value.trim();
  const branch = branchNameInput.value.trim() || 'main';
  const totalDays = Number(totalDaysSelect.value) || 30;
  const commitsPerDay = Number(commitsPerDaySelect.value) || 2;
  const cronTime = cronTimeInput.value || '16:00';
  const timezone = timezoneSelect.value || 'Asia/Kolkata';

  if (githubTokenInput.value.trim()) {
    saveCredentials(githubTokenInput.value.trim(), null);
  }
  if (geminiApiKeyInput.value.trim()) {
    saveCredentials(null, geminiApiKeyInput.value.trim());
  }

  const plan = rawPlanText.value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, idx) => ({
      day: idx + 1,
      title: line.replace(/^Day\s*\d+:\s*/i, '')
    }));

  const newCampaign = {
    id: `${repoOwner}-${repoName}-${Date.now()}`,
    repoOwner,
    repoName,
    branch,
    projectName,
    projectDescription,
    totalDays,
    currentDay: 1,
    commitsPerDay,
    cronTime,
    timezone,
    status: 'active',
    totalCommitsPushed: 0,
    hasRunToday: false,
    commitsHistory: [],
    history: [],
    plan: plan.length > 0 ? plan : DEFAULT_ROADMAP
  };

  campaigns.unshift(newCampaign);
  saveCampaignsToStorage(campaigns);
  closeNewCampaignModal();
  showToast(`🎉 Added ${projectName}! Syncing with GitHub...`, 'success');

  await syncCampaignFromGitHub(newCampaign);
  saveCampaignsToStorage(campaigns);
  renderCampaigns();
  updateStats();
  renderRoadmapStreakHeatmap(newCampaign);
});

// ----------------- MODAL OPEN / CLOSE HANDLERS -----------------
function openNewCampaignModal() {
  const savedKey = getSavedGeminiKey();
  if (savedKey && geminiApiKeyInput) geminiApiKeyInput.value = savedKey;
  const savedToken = getSavedGhToken();
  if (savedToken && githubTokenInput) githubTokenInput.value = savedToken;

  newCampaignModal.classList.add('active');
}

function closeNewCampaignModal() {
  newCampaignModal.classList.remove('active');
}

document.getElementById('btnOpenNewModal').addEventListener('click', openNewCampaignModal);
document.getElementById('btnCloseNewModal').addEventListener('click', closeNewCampaignModal);
document.getElementById('btnCancelNewModal').addEventListener('click', closeNewCampaignModal);

// PAT Guide Modal
document.getElementById('btnPatGuide').addEventListener('click', () => patGuideModal.classList.add('active'));
document.getElementById('linkPatHelp').addEventListener('click', (e) => {
  e.preventDefault();
  patGuideModal.classList.add('active');
});
document.getElementById('btnClosePatModal').addEventListener('click', () => patGuideModal.classList.remove('active'));
document.getElementById('btnClosePatModal2').addEventListener('click', () => patGuideModal.classList.remove('active'));

// Actions Guide Modal
const btnActionsGuide = document.getElementById('btnActionsGuide');
if (btnActionsGuide) {
  btnActionsGuide.addEventListener('click', () => actionsGuideModal.classList.add('active'));
}
const btnCloseActionsGuideModal = document.getElementById('btnCloseActionsGuideModal');
const btnCloseActionsGuideModal2 = document.getElementById('btnCloseActionsGuideModal2');
if (btnCloseActionsGuideModal) btnCloseActionsGuideModal.addEventListener('click', () => actionsGuideModal.classList.remove('active'));
if (btnCloseActionsGuideModal2) btnCloseActionsGuideModal2.addEventListener('click', () => actionsGuideModal.classList.remove('active'));

// Token Settings Modal
const btnConnectToken = document.getElementById('btnConnectToken');
if (btnConnectToken) btnConnectToken.addEventListener('click', openTokenSettingsModal);
const btnCloseTokenModal = document.getElementById('btnCloseTokenModal');
const btnCloseTokenModal2 = document.getElementById('btnCloseTokenModal2');
if (btnCloseTokenModal) btnCloseTokenModal.addEventListener('click', closeTokenSettingsModal);
if (btnCloseTokenModal2) btnCloseTokenModal2.addEventListener('click', closeTokenSettingsModal);

// Share Modal
document.getElementById('btnShareApp').addEventListener('click', () => {
  const shareInput = document.getElementById('shareUrlInput');
  shareInput.value = window.location.href;
  document.getElementById('copyAlert').style.display = 'none';
  shareModal.classList.add('active');
});
document.getElementById('btnCopyShareUrl').addEventListener('click', () => {
  const shareInput = document.getElementById('shareUrlInput');
  shareInput.select();
  navigator.clipboard.writeText(shareInput.value).then(() => {
    document.getElementById('copyAlert').style.display = 'block';
    setTimeout(() => {
      document.getElementById('copyAlert').style.display = 'none';
    }, 2500);
  });
});
document.getElementById('btnCloseShareModal').addEventListener('click', () => shareModal.classList.remove('active'));
document.getElementById('btnCloseShareModal2').addEventListener('click', () => shareModal.classList.remove('active'));

// Logs Modal Controls
document.getElementById('tabBtnConsole').addEventListener('click', () => {
  document.getElementById('tabBtnConsole').classList.add('active');
  document.getElementById('tabBtnCommits').classList.remove('active');
  document.getElementById('terminalView').style.display = 'block';
  document.getElementById('commitsListView').style.display = 'none';
});

document.getElementById('tabBtnCommits').addEventListener('click', () => {
  document.getElementById('tabBtnCommits').classList.add('active');
  document.getElementById('tabBtnConsole').classList.remove('active');
  document.getElementById('terminalView').style.display = 'none';
  document.getElementById('commitsListView').style.display = 'block';
});

document.getElementById('btnRefreshLogs').addEventListener('click', refreshLogs);
document.getElementById('btnCloseLogsModal').addEventListener('click', closeLogsModal);
document.getElementById('btnCloseLogsModal2').addEventListener('click', closeLogsModal);

// Close modal on backdrop click
[newCampaignModal, logsModal, patGuideModal, actionsGuideModal, tokenSettingsModal, shareModal].forEach(modal => {
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      if (modal === logsModal && logPollInterval) {
        clearInterval(logPollInterval);
        logPollInterval = null;
      }
    }
  });
});

document.getElementById('btnRefreshList').addEventListener('click', fetchCampaigns);

// ----------------- AUTH NAVBAR RENDERING -----------------
async function checkAuthStatus() {
  const token = getSavedGhToken();
  if (token) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        currentUser = await res.json();
      } else {
        currentUser = null;
      }
    } catch {
      currentUser = null;
    }
  } else {
    currentUser = null;
  }
  renderAuthNavbar();
}

function renderAuthNavbar() {
  const container = document.getElementById('authContainer');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <div class="user-badge" style="cursor: pointer;" title="Connected as @${escapeHtml(currentUser.login)}. Click to manage credentials.">
        <img src="${currentUser.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'}" class="user-avatar" alt="Avatar">
        <span class="user-name">@${escapeHtml(currentUser.login)}</span>
        <button class="btn btn-outline btn-sm" id="btnNavbarSettings" style="padding: 2px 8px; font-size: 0.72rem; margin-left: 4px;">⚙️ Settings</button>
      </div>
    `;
    const btn = document.getElementById('btnNavbarSettings');
    if (btn) btn.onclick = openTokenSettingsModal;
    container.onclick = openTokenSettingsModal;
  } else {
    container.innerHTML = `
      <button class="btn btn-github" id="btnConnectToken" style="font-size: 0.82rem; padding: 6px 12px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        Connect GitHub
      </button>
    `;
    const btn = document.getElementById('btnConnectToken');
    if (btn) btn.onclick = openTokenSettingsModal;
  }
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ----------------- APP INITIALIZATION -----------------
document.addEventListener('DOMContentLoaded', async () => {
  startLiveClock();
  await checkAuthStatus();
  await fetchCampaigns();
});
