/**
 * GitStreak AI — Client-Side Application Controller
 */

// Application State
let campaigns = [];
let activeViewingCampaignId = null;
let logPollInterval = null;
let currentUser = null;
let isOAuthConfigured = false;
let userRepos = [];

// DOM Elements
const istClockPill = document.getElementById('istClockPill');
const liveIstTime = document.getElementById('liveIstTime');
const campaignsGrid = document.getElementById('campaignsGrid');
const statActiveCount = document.getElementById('statActiveCount');
const statCommitsCount = document.getElementById('statCommitsCount');
const heatmapGrid = document.getElementById('heatmapGrid');

// Modals
const newCampaignModal = document.getElementById('newCampaignModal');
const logsModal = document.getElementById('logsModal');
const patGuideModal = document.getElementById('patGuideModal');
const shareModal = document.getElementById('shareModal');

// Forms & Verification
const newCampaignForm = document.getElementById('newCampaignForm');
const repoUrlInput = document.getElementById('repoUrl');
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

// ----------------- TOAST NOTIFICATIONS -----------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
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

// ----------------- LIVE CLOCK & HEATMAP -----------------
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
      liveIstTime.textContent = `${now} IST`;
    } catch {
      liveIstTime.textContent = new Date().toLocaleTimeString();
    }
  }
  update();
  setInterval(update, 1000);
}

function renderHeatmapSimulator() {
  heatmapGrid.innerHTML = '';
  // 35 cells (5 rows x 7 cols) with bright streaks
  const levels = [
    3, 4, 4, 2, 4, 3, 4,
    4, 3, 4, 4, 4, 2, 4,
    2, 4, 3, 4, 4, 3, 4,
    4, 4, 2, 4, 3, 4, 4,
    3, 4, 4, 4, 4, 4, 4
  ];

  levels.forEach(lv => {
    const cell = document.createElement('div');
    cell.className = `heatmap-cell lv-${lv}`;
    cell.title = `${lv * 2} commits pushed`;
    heatmapGrid.appendChild(cell);
  });
}

// ----------------- API CALLS -----------------
async function fetchCampaigns() {
  try {
    const savedToken = localStorage.getItem('gitstreak_jwt');
    const headers = savedToken ? { 'Authorization': `Bearer ${savedToken}` } : {};
    const res = await fetch('/api/campaigns', { headers });
    if (!res.ok) throw new Error('Failed to load campaigns');
    campaigns = await res.json();
    renderCampaigns();
    updateStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateStats() {
  const active = campaigns.filter(c => c.status === 'active').length;
  const totalCommits = campaigns.reduce((acc, c) => acc + (c.totalCommitsPushed || 0), 0);

  statActiveCount.textContent = active;
  statCommitsCount.textContent = totalCommits;
}

// ----------------- RENDER CAMPAIGN CARDS -----------------
function renderCampaigns() {
  if (!currentUser) {
    campaignsGrid.innerHTML = `
      <div class="empty-state auth-gate-card">
        <div class="empty-icon" style="background: rgba(36, 41, 47, 0.8); color: #fff;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </div>
        <h4>Sign In to View & Create Automations</h4>
        <p>To prevent unauthorized actions and remember your streak campaigns across visits, please sign in with your GitHub account.</p>
        <a href="/api/auth/github" class="btn btn-github btn-lg" style="margin-top: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Sign in with GitHub
        </a>
      </div>
    `;
    return;
  }

  if (campaigns.length === 0) {
    campaignsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <h4>Welcome, @${escapeHtml(currentUser.username)}!</h4>
        <p>You don't have any ongoing project automations yet. Start your first automated daily streak!</p>
        <button class="btn btn-primary" onclick="openNewCampaignModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Create First Automation
        </button>
      </div>
    `;
    return;
  }

  campaignsGrid.innerHTML = campaigns.map(c => {
    const currentDay = c.currentDay || 1;
    const totalDays = c.totalDays || 30;
    const progressPercent = Math.min(100, Math.round(((currentDay - 1) / totalDays) * 100));

    // Next milestone text
    let milestoneText = `Day ${currentDay} tasks`;
    if (Array.isArray(c.plan) && c.plan[currentDay - 1]) {
      const p = c.plan[currentDay - 1];
      milestoneText = typeof p === 'string' ? p : `${p.title}: ${p.description || ''}`;
    }

    const isTodayDone = c.hasRunToday;
    const commitsCount = (c.commitsHistory || []).length;

    return `
      <div class="campaign-card" data-id="${c.id}">
        <div class="card-top">
          <div class="card-project-info">
            <h4>${escapeHtml(c.projectName)}</h4>
            <a href="https://github.com/${c.repoOwner}/${c.repoName}" target="_blank" rel="noopener" class="repo-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              ${c.repoOwner}/${c.repoName}
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
            ${c.cronTime || '18:00'} IST
          </span>
          <span class="meta-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
            ${c.commitsPerDay} commits/day
          </span>
          <span class="meta-chip ${isTodayDone ? 'today-done' : ''}">
            ${isTodayDone ? '✅ Today Completed' : '⏳ Queued for 18:00 IST'}
          </span>
          <span class="meta-chip">
            📦 ${commitsCount} Pushed
          </span>
        </div>

        <!-- Actions -->
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" onclick="triggerManualRun('${c.id}', this)" ${c.status === 'completed' ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            Run Today's Commit
          </button>
          
          <button class="btn btn-secondary btn-sm" onclick="openLogsModal('${c.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
            Logs
          </button>

          <button class="btn btn-outline btn-sm btn-icon-only" title="${c.status === 'active' ? 'Pause Automation' : 'Resume Automation'}" onclick="togglePauseResume('${c.id}', '${c.status}')">
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

// ----------------- MANUAL RUN TRIGGER -----------------
async function triggerManualRun(campaignId, btnElement) {
  const originalHtml = btnElement.innerHTML;
  btnElement.disabled = true;
  btnElement.innerHTML = `
    <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
    Building & Pushing...
  `;

  showToast('AI is generating today\'s code and pushing to GitHub...', 'info');

  try {
    const res = await fetch(`/api/campaigns/${campaignId}/run`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Execution failed');
    }

    showToast(`🎉 Success! Pushed ${data.result.commits?.length || 1} commits to GitHub!`, 'success');
    await fetchCampaigns();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btnElement.disabled = false;
    btnElement.innerHTML = originalHtml;
  }
}

// ----------------- TOGGLE PAUSE / RESUME -----------------
async function togglePauseResume(campaignId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  try {
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Failed to update status');
    showToast(`Campaign ${newStatus === 'active' ? 'resumed' : 'paused'}.`, 'info');
    await fetchCampaigns();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------- DELETE CAMPAIGN -----------------
async function deleteCampaign(campaignId) {
  if (!confirm('Are you sure you want to delete this campaign? Existing commits in your GitHub repo will remain intact.')) {
    return;
  }

  try {
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete campaign');
    showToast('Automation deleted.', 'info');
    await fetchCampaigns();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------- VERIFY GITHUB TOKEN & REPO -----------------
btnTestGithub.addEventListener('click', async () => {
  const token = githubTokenInput.value.trim();
  const repoUrl = repoUrlInput.value.trim();

  if (!token || !repoUrl) {
    githubVerifyStatus.className = 'verify-status error';
    githubVerifyStatus.textContent = 'Please enter both Repository URL and GitHub PAT first.';
    return;
  }

  btnTestGithub.disabled = true;
  githubVerifyStatus.className = 'verify-status info';
  githubVerifyStatus.style.display = 'block';
  githubVerifyStatus.textContent = 'Testing connection to GitHub...';

  try {
    const res = await fetch('/api/test/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, repoUrl })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Connection failed');
    }

    githubVerifyStatus.className = 'verify-status success';
    githubVerifyStatus.innerHTML = `
      ✓ Connected as <strong>@${data.user.login}</strong> (${data.user.name}) &bull; Target repo: <strong>${data.repository.fullName}</strong> [${data.repository.defaultBranch}]
    `;

    // Pre-fill committer identity if empty
    if (!committerNameInput.value && data.user.name) {
      committerNameInput.value = data.user.name;
    }
    if (!committerEmailInput.value && data.user.email) {
      committerEmailInput.value = data.user.email;
    }
  } catch (err) {
    githubVerifyStatus.className = 'verify-status error';
    githubVerifyStatus.textContent = `Error: ${err.message}`;
  } finally {
    btnTestGithub.disabled = false;
  }
});

// ----------------- VERIFY GEMINI API KEY -----------------
btnTestGemini.addEventListener('click', async () => {
  const apiKey = geminiApiKeyInput.value.trim();
  if (!apiKey) {
    geminiVerifyStatus.className = 'verify-status error';
    geminiVerifyStatus.textContent = 'Please enter a Gemini API Key.';
    return;
  }

  btnTestGemini.disabled = true;
  geminiVerifyStatus.className = 'verify-status info';
  geminiVerifyStatus.style.display = 'block';
  geminiVerifyStatus.textContent = 'Verifying key with Google Gemini API...';

  try {
    const res = await fetch('/api/test/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Key verification failed');
    }

    geminiVerifyStatus.className = 'verify-status success';
    geminiVerifyStatus.innerHTML = `✓ Google Gemini API Key verified! Active model: <strong>${data.model || 'Gemini Flash'}</strong>`;
  } catch (err) {
    geminiVerifyStatus.className = 'verify-status error';
    geminiVerifyStatus.textContent = `Error: ${err.message}`;
  } finally {
    btnTestGemini.disabled = false;
  }
});

// ----------------- AUTO-PLAN WITH GEMINI -----------------
btnAutoPlan.addEventListener('click', async () => {
  const apiKey = geminiApiKeyInput.value.trim();
  const projectName = projectNameInput.value.trim();
  const description = projectDescInput.value.trim();
  const totalDays = totalDaysSelect.value;

  if (!apiKey) {
    showToast('Please enter your Google Gemini API Key first!', 'error');
    geminiApiKeyInput.focus();
    return;
  }
  if (!projectName) {
    showToast('Please enter a Project Name first!', 'error');
    projectNameInput.focus();
    return;
  }

  btnAutoPlan.disabled = true;
  btnAutoPlan.textContent = '✨ Generating Plan with AI...';

  try {
    const res = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        projectName,
        description,
        totalDays
      })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to auto-plan');
    }

    // Format plan into readable lines
    const planText = data.plan
      .map(item => `Day ${item.day}: ${item.title} — ${item.description}`)
      .join('\n');

    rawPlanText.value = planText;
    showToast(`✨ Generated ${data.plan.length}-day technical roadmap!`, 'success');
  } catch (err) {
    showToast(`Auto-Plan error: ${err.message}`, 'error');
  } finally {
    btnAutoPlan.disabled = false;
    btnAutoPlan.textContent = '✨ Auto-Plan with Gemini AI';
  }
});

// ----------------- FORM SUBMIT: CREATE CAMPAIGN -----------------
newCampaignForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const repoUrl = repoUrlInput.value.trim();
  const githubToken = githubTokenInput.value.trim();

  // If not logged in and no token provided, require token
  if (!githubToken && !currentUser) {
    showToast('Please enter your GitHub Personal Access Token or Sign in with GitHub!', 'error');
    githubTokenInput.focus();
    return;
  }

  const branch = document.getElementById('branchName').value.trim() || 'main';
  const projectName = projectNameInput.value.trim();
  const projectDescription = projectDescInput.value.trim();
  const totalDays = Number(totalDaysSelect.value);
  const commitsPerDay = Number(commitsPerDaySelect.value);
  const cronTime = cronTimeInput.value;
  const timezone = timezoneSelect.value;
  const geminiApiKey = geminiApiKeyInput.value.trim();
  const committerName = committerNameInput.value.trim();
  const committerEmail = committerEmailInput.value.trim();

  // Parse plan lines
  const planLines = rawPlanText.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const submitBtn = document.getElementById('btnSubmitNew');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Activating...';

  try {
    const savedToken = localStorage.getItem('gitstreak_jwt');
    const headers = {
      'Content-Type': 'application/json',
      ...(savedToken ? { 'Authorization': `Bearer ${savedToken}` } : {})
    };

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        repoUrl,
        githubToken,
        branch,
        projectName,
        projectDescription,
        totalDays,
        commitsPerDay,
        cronTime,
        timezone,
        geminiApiKey,
        committerName,
        committerEmail,
        plan: planLines
      })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create campaign');
    }

    showToast(`🎉 Automation "${projectName}" created and scheduled!`, 'success');
    closeNewCampaignModal();
    newCampaignForm.reset();
    githubVerifyStatus.style.display = 'none';
    geminiVerifyStatus.style.display = 'none';
    await fetchCampaigns();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Activate Automation';
  }
});

// ----------------- LOGS & COMMITS MODAL -----------------
async function openLogsModal(campaignId) {
  activeViewingCampaignId = campaignId;
  logsModal.classList.add('active');

  const campaign = campaigns.find(c => c.id === campaignId);
  if (campaign) {
    document.getElementById('logsModalTitle').textContent = `${campaign.projectName} &bull; Activity`;
  }

  await refreshLogs();

  // Auto-poll logs while open
  if (logPollInterval) clearInterval(logPollInterval);
  logPollInterval = setInterval(refreshLogs, 4000);
}

function closeLogsModal() {
  logsModal.classList.remove('active');
  if (logPollInterval) clearInterval(logPollInterval);
  logPollInterval = null;
  activeViewingCampaignId = null;
}

async function refreshLogs() {
  if (!activeViewingCampaignId) return;

  try {
    const [logsRes, campaignRes] = await Promise.all([
      fetch(`/api/campaigns/${activeViewingCampaignId}/logs`),
      fetch(`/api/campaigns/${activeViewingCampaignId}`)
    ]);

    const logs = await logsRes.json();
    const campaign = await campaignRes.json();

    // Render terminal lines
    const terminalOutput = document.getElementById('terminalOutput');
    if (logs.length === 0) {
      terminalOutput.textContent = '[Ready] Waiting for scheduled run or manual trigger...';
    } else {
      terminalOutput.textContent = logs.map(l => {
        const time = new Date(l.timestamp).toLocaleTimeString();
        return `[${time}] [${l.level.toUpperCase()}] ${l.message}`;
      }).join('\n');
    }

    // Render commits
    const commits = campaign.commitsHistory || [];
    document.getElementById('commitCountBadge').textContent = commits.length;
    const tableBody = document.getElementById('commitsTableBody');

    if (commits.length === 0) {
      tableBody.innerHTML = '<p class="text-dim" style="padding: 12px; font-size: 0.85rem;">No commits pushed yet.</p>';
    } else {
      tableBody.innerHTML = commits.map(c => `
        <div class="commit-item">
          <div class="commit-left">
            <span class="commit-msg">${escapeHtml(c.message)}</span>
            <span class="commit-sub">Day ${c.day || 1} &bull; ${(c.filesPushed || []).join(', ')}</span>
          </div>
          <a href="${c.htmlUrl}" target="_blank" rel="noopener" class="commit-sha-link">
            ${c.sha ? c.sha.substring(0, 7) : 'View Commit'} &nearr;
          </a>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

// Tab Switching inside Logs Modal
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

// ----------------- MODAL OPEN / CLOSE HANDLERS -----------------
function openNewCampaignModal() {
  if (!currentUser) {
    showToast('Please sign in with GitHub before creating an automation project!', 'error');
    if (isOAuthConfigured) {
      window.location.href = '/api/auth/github';
    } else {
      openOauthModal();
    }
    return;
  }

  // Pre-fill saved Gemini API key if available
  if (currentUser.savedGeminiApiKey && !geminiApiKeyInput.value) {
    geminiApiKeyInput.value = currentUser.savedGeminiApiKey;
  }

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

// Share Modal
document.getElementById('btnShareApp').addEventListener('click', () => {
  const shareInput = document.getElementById('shareUrlInput');
  shareInput.value = window.location.origin;
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

// cron-job.org Modal
const cronJobModal = document.getElementById('cronJobModal');
const btnCronJobGuide = document.getElementById('btnCronJobGuide');
const cronWebhookUrl = document.getElementById('cronWebhookUrl');
const btnCopyCronUrl = document.getElementById('btnCopyCronUrl');
const btnTestCronEndpoint = document.getElementById('btnTestCronEndpoint');
const cronEndpointStatus = document.getElementById('cronEndpointStatus');

btnCronJobGuide.addEventListener('click', () => {
  cronWebhookUrl.value = `${window.location.origin}/api/cron/trigger`;
  cronEndpointStatus.style.display = 'none';
  cronJobModal.classList.add('active');
});

btnCopyCronUrl.addEventListener('click', () => {
  cronWebhookUrl.select();
  navigator.clipboard.writeText(cronWebhookUrl.value).then(() => {
    showToast('cron-job.org webhook URL copied!', 'success');
  });
});

btnTestCronEndpoint.addEventListener('click', async () => {
  btnTestCronEndpoint.disabled = true;
  btnTestCronEndpoint.textContent = 'Testing webhook trigger...';
  cronEndpointStatus.className = 'verify-status info';
  cronEndpointStatus.style.display = 'block';
  cronEndpointStatus.textContent = 'Triggering /api/cron/trigger webhook...';

  try {
    const res = await fetch('/api/cron/trigger?force=true');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed');

    cronEndpointStatus.className = 'verify-status success';
    const executedCount = data.results?.length || 0;
    cronEndpointStatus.innerHTML = `✓ Webhook responded 200 OK! Evaluated ${executedCount} active campaign(s).`;
    showToast('Webhook trigger test succeeded!', 'success');
    await fetchCampaigns();
  } catch (err) {
    cronEndpointStatus.className = 'verify-status error';
    cronEndpointStatus.textContent = `Error: ${err.message}`;
  } finally {
    btnTestCronEndpoint.disabled = false;
    btnTestCronEndpoint.textContent = 'Test Webhook Trigger Now';
  }
});

document.getElementById('btnCloseCronModal').addEventListener('click', () => cronJobModal.classList.remove('active'));
document.getElementById('btnCloseCronModal2').addEventListener('click', () => cronJobModal.classList.remove('active'));

// ----------------- AUTHENTICATION & REPOSITORIES -----------------
async function checkAuthAndDbStatus() {
  try {
    // Save token if received in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('gitstreak_jwt', tokenFromUrl);
    }

    const savedToken = localStorage.getItem('gitstreak_jwt');
    const headers = savedToken ? { 'Authorization': `Bearer ${savedToken}` } : {};

    const res = await fetch('/api/auth/status', { headers });
    const data = await res.json();
    isOAuthConfigured = data.isOAuthConfigured;
    currentUser = data.user;

    renderAuthNavbar();

    // Check system time & DB
    const timeRes = await fetch('/api/system/time');
    const timeData = await timeRes.json();
    const dbStatusEl = document.getElementById('statDbStatus');
    if (dbStatusEl) {
      dbStatusEl.textContent = timeData.database?.includes('MongoDB') ? 'MongoDB Atlas' : 'Local DB';
    }
    const dbEngineText = document.getElementById('dbEngineText');
    if (dbEngineText) {
      dbEngineText.textContent = timeData.database || 'Local Persistent Storage';
    }

    if (currentUser) {
      loadUserRepositories();
      if (currentUser.savedGeminiApiKey && !geminiApiKeyInput.value) {
        geminiApiKeyInput.value = currentUser.savedGeminiApiKey;
      }
    }
  } catch (err) {
    console.error('Error checking auth:', err);
  }
}

function renderAuthNavbar() {
  const container = document.getElementById('authContainer');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <div class="user-badge" title="Logged in as @${escapeHtml(currentUser.username)}">
        <img src="${currentUser.avatarUrl || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'}" class="user-avatar" alt="Avatar">
        <span class="user-name">@${escapeHtml(currentUser.username)}</span>
        <button class="btn btn-outline btn-sm" id="btnSignOut" style="padding: 2px 8px; font-size: 0.72rem; margin-left: 4px;">Sign Out</button>
      </div>
    `;

    document.getElementById('btnSignOut').addEventListener('click', async () => {
      localStorage.removeItem('gitstreak_jwt');
      await fetch('/api/auth/logout', { method: 'POST' });
      showToast('Signed out of GitHub.', 'info');
      currentUser = null;
      renderAuthNavbar();
      fetchCampaigns();
    });

    const badge = document.getElementById('oauthActiveBadge');
    if (badge) badge.style.display = 'block';
    const patReq = document.getElementById('patRequiredAsterisk');
    if (patReq) patReq.style.display = 'none';
    const patHint = document.getElementById('patHint');
    if (patHint) patHint.innerHTML = 'Optional: Using your authenticated GitHub OAuth session by default.';

    if (committerNameInput && !committerNameInput.value) {
      committerNameInput.value = currentUser.displayName || currentUser.username;
    }
    if (committerEmailInput && !committerEmailInput.value) {
      committerEmailInput.value = currentUser.email || '';
    }
  } else {
    container.innerHTML = `
      <a href="/api/auth/github" class="btn btn-github" id="btnGithubLogin">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        Sign in with GitHub
      </a>
    `;

    document.getElementById('btnGithubLogin').addEventListener('click', (e) => {
      if (!isOAuthConfigured) {
        e.preventDefault();
        openOauthModal();
      }
    });

    const badge = document.getElementById('oauthActiveBadge');
    if (badge) badge.style.display = 'none';
    const repoGroup = document.getElementById('repoSelectorGroup');
    if (repoGroup) repoGroup.style.display = 'none';
    const patReq = document.getElementById('patRequiredAsterisk');
    if (patReq) patReq.style.display = 'inline';
    const patHint = document.getElementById('patHint');
    if (patHint) patHint.innerHTML = 'Needs <code>repo</code> scope permission. Don\'t have one? <a href="#" id="linkPatHelp">Click here for the 30-second guide</a>.';
  }
}

async function loadUserRepositories() {
  try {
    const res = await fetch('/api/user/repos');
    const data = await res.json();
    if (!res.ok || !data.success) return;

    userRepos = data.repos || [];
    const select = document.getElementById('userRepoSelect');
    const group = document.getElementById('repoSelectorGroup');

    if (select && userRepos.length > 0) {
      select.innerHTML = '<option value="">-- Choose one of your repositories --</option>' +
        userRepos.map(r => `<option value="${escapeHtml(r.htmlUrl)}" data-branch="${escapeHtml(r.defaultBranch)}" data-name="${escapeHtml(r.name)}">${escapeHtml(r.fullName)} (${r.private ? '🔒 Private' : '🌐 Public'})</option>`).join('');

      group.style.display = 'block';

      select.addEventListener('change', () => {
        const selected = select.options[select.selectedIndex];
        if (select.value) {
          repoUrlInput.value = select.value;
          document.getElementById('branchName').value = selected.getAttribute('data-branch') || 'main';
          if (!projectNameInput.value) {
            projectNameInput.value = selected.getAttribute('data-name') || '';
          }
        }
      });
    }
  } catch (err) {
    console.error('Error loading repositories:', err);
  }
}

// Database Modal Handlers
const dbModal = document.getElementById('dbModal');
const btnDbInfo = document.getElementById('btnDbInfo');
if (btnDbInfo) {
  btnDbInfo.addEventListener('click', () => {
    dbModal.classList.add('active');
  });
}
const btnCloseDbModal = document.getElementById('btnCloseDbModal');
const btnCloseDbModal2 = document.getElementById('btnCloseDbModal2');
if (btnCloseDbModal) btnCloseDbModal.addEventListener('click', () => dbModal.classList.remove('active'));
if (btnCloseDbModal2) btnCloseDbModal2.addEventListener('click', () => dbModal.classList.remove('active'));

// OAuth Modal Handlers
const oauthModal = document.getElementById('oauthModal');
function openOauthModal() {
  const homeEl = document.getElementById('oauthHomeUrlText');
  const callbackEl = document.getElementById('oauthCallbackUrlText');
  if (homeEl) homeEl.textContent = window.location.origin;
  if (callbackEl) callbackEl.textContent = `${window.location.origin}/api/auth/github/callback`;
  oauthModal.classList.add('active');
}
const btnCloseOauthModal = document.getElementById('btnCloseOauthModal');
const btnCloseOauthModal2 = document.getElementById('btnCloseOauthModal2');
if (btnCloseOauthModal) btnCloseOauthModal.addEventListener('click', () => oauthModal.classList.remove('active'));
if (btnCloseOauthModal2) btnCloseOauthModal2.addEventListener('click', () => oauthModal.classList.remove('active'));

// Close modal on backdrop click
[newCampaignModal, logsModal, patGuideModal, shareModal, cronJobModal, dbModal, oauthModal].forEach(modal => {
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

// Helper
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
document.addEventListener('DOMContentLoaded', () => {
  startLiveClock();
  renderHeatmapSimulator();
  checkAuthAndDbStatus();
  fetchCampaigns();

  // Check query params for auth notification
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('auth') === 'success') {
    showToast('🎉 Successfully signed in with GitHub!', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('auth') === 'error') {
    showToast(`OAuth Error: ${urlParams.get('msg') || 'Failed to authenticate'}`, 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
