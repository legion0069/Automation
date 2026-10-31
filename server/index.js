require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const github = require('./github');
const gemini = require('./gemini');
const streakRunner = require('./streakRunner');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Parse GitHub repo URL into owner & repo
function parseRepoUrl(url) {
  if (!url) return null;
  const cleaned = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

// ----------------- SYSTEM & TIME API -----------------
app.get('/api/system/time', (req, res) => {
  const istTime = scheduler.getCurrentTimeInTimezone('Asia/Kolkata');
  const fullIst = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'long'
  }).format(new Date());

  res.json({
    currentTimeIst: istTime,
    formattedIst: fullIst,
    cronTarget: '18:00 IST (6:00 PM)',
    systemUtc: new Date().toISOString()
  });
});

// ----------------- CRON-JOB.ORG / EXTERNAL SCHEDULER WEBHOOK -----------------
// Supports both GET and POST from cron-job.org
const handleCronTrigger = async (req, res) => {
  try {
    const secret = req.query.secret || req.headers['x-cron-secret'] || req.body?.secret;
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
    }

    const force = req.query.force === 'true' || req.body?.force === true;
    const campaignId = req.query.campaignId || req.body?.campaignId || null;

    console.log(`[Webhook] Cron trigger received from external cron (force=${force}, campaignId=${campaignId || 'all'})`);
    const results = await scheduler.triggerCronJobWebhook({ force, campaignId });

    res.json({
      success: true,
      message: 'cron-job.org trigger executed successfully',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (err) {
    console.error('[Webhook] Cron trigger error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

app.get('/api/cron/trigger', handleCronTrigger);
app.post('/api/cron/trigger', handleCronTrigger);

// ----------------- VALIDATION & AI HELPERS -----------------

// Validate GitHub Token & Repo
app.post('/api/test/github', async (req, res) => {
  try {
    const { token, repoUrl } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'GitHub Personal Access Token is required.' });
    }
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL. Format: https://github.com/owner/repo' });
    }

    const result = await github.validateTokenAndRepo({
      token,
      owner: parsed.owner,
      repo: parsed.repo
    });

    res.json({
      success: true,
      owner: parsed.owner,
      repo: parsed.repo,
      ...result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Validate Gemini API Key
app.post('/api/test/gemini', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const keyToUse = apiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return res.status(400).json({ error: 'Gemini API Key is required.' });
    }

    const result = await gemini.validateGeminiApiKey(keyToUse);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// AI Auto-Generate Plan
app.post('/api/generate-plan', async (req, res) => {
  try {
    const { apiKey, projectName, description, totalDays } = req.body;
    const keyToUse = apiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return res.status(400).json({ error: 'Gemini API Key is required to auto-generate a plan.' });
    }
    if (!projectName) {
      return res.status(400).json({ error: 'Project Name is required.' });
    }

    const plan = await gemini.generateProjectPlan({
      apiKey: keyToUse,
      projectName,
      description: description || 'Software project with frontend and backend components',
      totalDays: Number(totalDays) || 14
    });

    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- CAMPAIGNS API -----------------

// List all campaigns
app.get('/api/campaigns', (req, res) => {
  const campaigns = db.getAllCampaigns();
  // Don't leak raw tokens back to listing for security
  const sanitized = campaigns.map(c => ({
    ...c,
    githubToken: c.githubToken ? `ghp_****${c.githubToken.slice(-4)}` : '',
    geminiApiKey: c.geminiApiKey ? `AIza****${c.geminiApiKey.slice(-4)}` : '',
    hasRunToday: scheduler.hasRunToday(c.lastRunAt, c.timezone || 'Asia/Kolkata')
  }));
  res.json(sanitized);
});

// Get single campaign
app.get('/api/campaigns/:id', (req, res) => {
  const campaign = db.getCampaign(req.params.id);
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  const logs = db.getLogs(req.params.id, 50);
  res.json({
    ...campaign,
    githubToken: campaign.githubToken ? `ghp_****${campaign.githubToken.slice(-4)}` : '',
    geminiApiKey: campaign.geminiApiKey ? `AIza****${campaign.geminiApiKey.slice(-4)}` : '',
    hasRunToday: scheduler.hasRunToday(campaign.lastRunAt, campaign.timezone || 'Asia/Kolkata'),
    recentLogs: logs
  });
});

// Create new campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const {
      projectName,
      projectDescription,
      repoUrl,
      branch,
      githubToken,
      geminiApiKey,
      totalDays,
      commitsPerDay,
      cronTime,
      timezone,
      committerName,
      committerEmail,
      plan
    } = req.body;

    if (!repoUrl) return res.status(400).json({ error: 'Repository URL is required.' });
    if (!githubToken) return res.status(400).json({ error: 'GitHub Personal Access Token is required.' });

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return res.status(400).json({ error: 'Invalid GitHub repository URL.' });

    // Verify token access
    const verification = await github.validateTokenAndRepo({
      token: githubToken,
      owner: parsed.owner,
      repo: parsed.repo
    });

    const newCampaign = await db.createCampaign({
      projectName: projectName || parsed.repo,
      projectDescription: projectDescription || '',
      repoUrl,
      repoOwner: parsed.owner,
      repoName: parsed.repo,
      branch: branch || verification.repository.defaultBranch || 'main',
      githubToken,
      geminiApiKey: geminiApiKey || process.env.GEMINI_API_KEY || '',
      totalDays: Number(totalDays) || 30,
      currentDay: 1,
      commitsPerDay: Number(commitsPerDay) || 2,
      cronTime: cronTime || '18:00',
      timezone: timezone || 'Asia/Kolkata',
      committerName: committerName || verification.user.name || verification.user.login,
      committerEmail: committerEmail || verification.user.email,
      plan: Array.isArray(plan) ? plan : []
    });

    await db.addLog(newCampaign.id, 'info', `Campaign "${newCampaign.projectName}" registered successfully.`);

    res.status(201).json({
      success: true,
      campaign: {
        ...newCampaign,
        githubToken: `ghp_****${newCampaign.githubToken.slice(-4)}`,
        geminiApiKey: newCampaign.geminiApiKey ? `AIza****${newCampaign.geminiApiKey.slice(-4)}` : ''
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update campaign (pause, resume, edit plan)
app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const existing = db.getCampaign(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });

    const updates = {};
    const allowed = [
      'projectName',
      'projectDescription',
      'status',
      'totalDays',
      'currentDay',
      'commitsPerDay',
      'cronTime',
      'timezone',
      'committerName',
      'committerEmail',
      'plan'
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (req.body.githubToken && !req.body.githubToken.startsWith('ghp_****')) {
      updates.githubToken = req.body.githubToken;
    }
    if (req.body.geminiApiKey && !req.body.geminiApiKey.startsWith('AIza****')) {
      updates.geminiApiKey = req.body.geminiApiKey;
    }

    const updated = await db.updateCampaign(req.params.id, updates);
    res.json({ success: true, campaign: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete campaign
app.delete('/api/campaigns/:id', async (req, res) => {
  const deleted = await db.deleteCampaign(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Campaign not found' });
  res.json({ success: true, message: 'Campaign deleted successfully' });
});

// Manually trigger today's commit run immediately
app.post('/api/campaigns/:id/run', async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = db.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Run asynchronously or await
    const result = await streakRunner.runCampaignDay(campaignId, true);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get campaign activity logs
app.get('/api/campaigns/:id/logs', (req, res) => {
  const logs = db.getLogs(req.params.id, 100);
  res.json(logs);
});

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Express and Scheduler
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 GitStreak AI Server running at http://localhost:${PORT}`);
  console.log(`📅 Scheduler set for daily run at 6:00 PM IST (Asia/Kolkata)`);
  console.log(`=================================================`);
  scheduler.startScheduler();
});
