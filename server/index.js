require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const github = require('./github');
const gemini = require('./gemini');
const streakRunner = require('./streakRunner');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Optional authentication middleware across all routes
app.use(auth.optionalAuth(db));

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
    systemUtc: new Date().toISOString(),
    database: db.isMongoConnected() ? 'MongoDB Atlas' : 'Local Persistent Storage'
  });
});

// ----------------- CRON-JOB.ORG / EXTERNAL SCHEDULER WEBHOOK -----------------
const handleCronTrigger = async (req, res) => {
  try {
    const secret = req.query.secret || req.headers['x-cron-secret'] || req.body?.secret;
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
    }

    const force = req.query.force === 'true' || req.body?.force === true;
    const campaignId = req.query.campaignId || req.body?.campaignId || null;

    console.log(`[Webhook] Cron trigger received (force=${force}, campaignId=${campaignId || 'all'})`);
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

// ----------------- AUTHENTICATION API (GITHUB OAUTH) -----------------

// System auth status
app.get('/api/auth/status', (req, res) => {
  res.json({
    isOAuthConfigured: auth.isOAuthConfigured(),
    isMongoConnected: db.isMongoConnected(),
    user: req.user ? {
      id: req.user.id,
      githubId: req.user.githubId,
      username: req.user.username,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl,
      email: req.user.email,
      hasToken: Boolean(req.user.accessToken),
      savedGeminiApiKey: req.user.geminiApiKey || ''
    } : null
  });
});

// Redirect to GitHub OAuth Authorization
app.get('/api/auth/github', (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${protocol}://${host}/api/auth/github/callback`;
    const url = auth.getGithubAuthUrl(redirectUri);
    res.redirect(url);
  } catch (err) {
    res.status(400).send(`
      <h2>GitHub OAuth Not Configured Yet</h2>
      <p>${err.message}</p>
      <p>Please set <strong>GITHUB_CLIENT_ID</strong> and <strong>GITHUB_CLIENT_SECRET</strong> in your environment variables.</p>
      <a href="/">← Return to Home</a>
    `);
  }
});

// GitHub OAuth Callback
app.get('/api/auth/github/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) throw new Error('Authorization code missing.');

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${protocol}://${host}/api/auth/github/callback`;

    const accessToken = await auth.exchangeCodeForToken(code, redirectUri);
    const profile = await auth.getGithubUserProfile(accessToken);

    const user = await db.findOrCreateUser({
      ...profile,
      accessToken
    });

    const jwtToken = auth.signUserToken(user);

    // Set 365-day cookie so user is remembered permanently
    res.cookie('gitstreak_jwt', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000
    });

    res.redirect(`/?auth=success&token=${encodeURIComponent(jwtToken)}`);
  } catch (err) {
    console.error('[OAuth Callback Error]:', err.message);
    res.redirect(`/?auth=error&msg=${encodeURIComponent(err.message)}`);
  }
});

// Get Current User Profile
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      githubId: req.user.githubId,
      username: req.user.username,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl,
      email: req.user.email,
      hasAccessToken: Boolean(req.user.accessToken)
    }
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('gitstreak_jwt');
  res.json({ success: true, message: 'Logged out' });
});

// Fetch authenticated user's repositories
app.get('/api/user/repos', async (req, res) => {
  try {
    const token = req.user?.accessToken || req.query.token;
    if (!token) {
      return res.status(400).json({ error: 'GitHub login or Personal Access Token required.' });
    }
    const repos = await auth.getGithubUserRepos(token);
    res.json({ success: true, repos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- VALIDATION & AI HELPERS -----------------

// Validate GitHub Token & Repo
app.post('/api/test/github', async (req, res) => {
  try {
    const token = req.body.token || req.user?.accessToken;
    const { repoUrl } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'GitHub Personal Access Token or login is required.' });
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
    const keyToUse = apiKey || req.user?.geminiApiKey || process.env.GEMINI_API_KEY;
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
    const keyToUse = apiKey || req.user?.geminiApiKey || process.env.GEMINI_API_KEY;
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

// List campaigns (user-scoped if logged in)
app.get('/api/campaigns', async (req, res) => {
  try {
    if (!req.user) {
      // Don't show automations to unauthenticated visitors
      return res.json([]);
    }
    const campaigns = await db.getAllCampaigns(req.user.id, req.user.username);
    const sanitized = campaigns.map(c => ({
      ...c,
      githubToken: c.githubToken ? `ghp_****${c.githubToken.slice(-4)}` : '',
      geminiApiKey: c.geminiApiKey ? `AIza****${c.geminiApiKey.slice(-4)}` : '',
      hasRunToday: scheduler.hasRunToday(c.lastRunAt, c.timezone || 'Asia/Kolkata')
    }));
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single campaign
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await db.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const logs = await db.getLogs(req.params.id, 50);
    res.json({
      ...campaign,
      githubToken: campaign.githubToken ? `ghp_****${campaign.githubToken.slice(-4)}` : '',
      geminiApiKey: campaign.geminiApiKey ? `AIza****${campaign.geminiApiKey.slice(-4)}` : '',
      hasRunToday: scheduler.hasRunToday(campaign.lastRunAt, campaign.timezone || 'Asia/Kolkata'),
      recentLogs: logs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    // ENFORCE AUTHENTICATION: Disallow creating automation without signing in
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication Required: You must sign in with GitHub before creating an automation project.'
      });
    }

    let {
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

    // Use user's OAuth access token if not manually provided
    if (!githubToken && req.user.accessToken) {
      githubToken = req.user.accessToken;
    }

    // Save/update Gemini API key in user profile so they never have to re-enter it
    const activeGeminiKey = geminiApiKey || req.user.geminiApiKey || process.env.GEMINI_API_KEY || '';
    if (geminiApiKey && geminiApiKey !== req.user.geminiApiKey) {
      await db.updateUserGeminiKey(req.user.id, geminiApiKey);
    }

    if (!repoUrl) return res.status(400).json({ error: 'Repository URL is required.' });
    if (!githubToken) return res.status(400).json({ error: 'GitHub Personal Access Token or GitHub Login is required.' });

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return res.status(400).json({ error: 'Invalid GitHub repository URL.' });

    // Verify token access
    const verification = await github.validateTokenAndRepo({
      token: githubToken,
      owner: parsed.owner,
      repo: parsed.repo
    });

    const newCampaign = await db.createCampaign({
      userId: req.user.id,
      projectName: projectName || parsed.repo,
      projectDescription: projectDescription || '',
      repoUrl,
      repoOwner: parsed.owner,
      repoName: parsed.repo,
      branch: branch || verification.repository.defaultBranch || 'main',
      githubToken,
      geminiApiKey: activeGeminiKey,
      totalDays: Number(totalDays) || 30,
      currentDay: 1,
      commitsPerDay: Number(commitsPerDay) || 2,
      cronTime: cronTime || '18:00',
      timezone: timezone || 'Asia/Kolkata',
      committerName: committerName || (req.user ? req.user.displayName : verification.user.name) || verification.user.login,
      committerEmail: committerEmail || (req.user ? req.user.email : verification.user.email),
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

// Update campaign
app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const existing = await db.getCampaign(req.params.id);
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
    const campaign = await db.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const result = await streakRunner.runCampaignDay(campaignId, true);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get campaign activity logs
app.get('/api/campaigns/:id/logs', async (req, res) => {
  const logs = await db.getLogs(req.params.id, 100);
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
