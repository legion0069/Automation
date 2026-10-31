const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '..', 'data', 'store.json');

// In-memory cache + lock
let cache = {
  campaigns: [],
  logs: []
};

let isWriting = false;
let pendingWrite = false;

function initDb() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      cache = JSON.parse(raw);
      if (!Array.isArray(cache.campaigns)) cache.campaigns = [];
      if (!Array.isArray(cache.logs)) cache.logs = [];
    } else {
      flushSync();
    }
  } catch (err) {
    console.error('[DB] Failed to init DB:', err.message);
  }
}

function flushSync() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(cache, null, 2), 'utf-8');
  fs.renameSync(tempFile, DATA_FILE);
}

async function persist() {
  if (isWriting) {
    pendingWrite = true;
    return;
  }
  isWriting = true;
  try {
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    await fs.promises.writeFile(tempFile, JSON.stringify(cache, null, 2), 'utf-8');
    await fs.promises.rename(tempFile, DATA_FILE);
  } catch (err) {
    console.error('[DB] Write error:', err);
  } finally {
    isWriting = false;
    if (pendingWrite) {
      pendingWrite = false;
      await persist();
    }
  }
}

initDb();

module.exports = {
  getAllCampaigns() {
    return [...cache.campaigns];
  },

  getCampaign(id) {
    return cache.campaigns.find(c => c.id === id) || null;
  },

  async createCampaign(data) {
    const now = new Date().toISOString();
    const newCampaign = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      status: 'active', // active, paused, completed, error
      projectName: data.projectName || 'Untitled Project',
      projectDescription: data.projectDescription || '',
      repoUrl: data.repoUrl,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
      branch: data.branch || 'main',
      githubToken: data.githubToken, // User's personal access token
      geminiApiKey: data.geminiApiKey || '', // User's Gemini API key
      totalDays: Number(data.totalDays) || 30,
      currentDay: Number(data.currentDay) || 1,
      commitsPerDay: Number(data.commitsPerDay) || 2,
      cronTime: data.cronTime || '18:00', // Default 6:00 PM IST
      timezone: data.timezone || 'Asia/Kolkata',
      committerName: data.committerName || 'GitStreak Bot',
      committerEmail: data.committerEmail || 'gitstreak@automation.local',
      plan: Array.isArray(data.plan) ? data.plan : [], // array of strings or day objects
      commitsHistory: [], // list of commits pushed
      lastRunAt: null,
      lastRunStatus: null,
      errorMessage: null,
      totalCommitsPushed: 0
    };

    cache.campaigns.unshift(newCampaign);
    await persist();
    return newCampaign;
  },

  async updateCampaign(id, updates) {
    const idx = cache.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return null;

    cache.campaigns[idx] = {
      ...cache.campaigns[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await persist();
    return cache.campaigns[idx];
  },

  async deleteCampaign(id) {
    const idx = cache.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return false;

    cache.campaigns.splice(idx, 1);
    // clean up related logs
    cache.logs = cache.logs.filter(l => l.campaignId !== id);
    await persist();
    return true;
  },

  async addLog(campaignId, level = 'info', message = '', metadata = null) {
    const entry = {
      id: uuidv4(),
      campaignId,
      timestamp: new Date().toISOString(),
      level, // info, success, warn, error
      message,
      metadata
    };

    cache.logs.unshift(entry);
    // keep logs under 1000 items
    if (cache.logs.length > 1000) {
      cache.logs = cache.logs.slice(0, 1000);
    }
    await persist();
    return entry;
  },

  getLogs(campaignId, limit = 50) {
    const filtered = campaignId
      ? cache.logs.filter(l => l.campaignId === campaignId)
      : cache.logs;
    return filtered.slice(0, limit);
  },

  async recordCommit(campaignId, commitRecord) {
    const campaign = cache.campaigns.find(c => c.id === campaignId);
    if (!campaign) return null;

    if (!Array.isArray(campaign.commitsHistory)) {
      campaign.commitsHistory = [];
    }
    campaign.commitsHistory.unshift(commitRecord);
    campaign.totalCommitsPushed = (campaign.totalCommitsPushed || 0) + 1;
    campaign.updatedAt = new Date().toISOString();
    await persist();
    return campaign;
  }
};
