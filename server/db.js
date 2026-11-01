const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const DATA_FILE = path.join(__dirname, '..', 'data', 'store.json');

let isMongoActive = false;

// ----------------- MONGOOSE SCHEMAS -----------------
const UserSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  githubId: { type: String, unique: true, sparse: true },
  username: { type: String, required: true },
  displayName: { type: String },
  avatarUrl: { type: String },
  email: { type: String },
  accessToken: { type: String }, // GitHub OAuth Token
  geminiApiKey: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const CampaignSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  userId: { type: String, index: true },
  projectName: { type: String, required: true },
  projectDescription: { type: String, default: '' },
  repoUrl: { type: String, required: true },
  repoOwner: { type: String, required: true },
  repoName: { type: String, required: true },
  branch: { type: String, default: 'main' },
  githubToken: { type: String, required: true },
  geminiApiKey: { type: String, default: '' },
  totalDays: { type: Number, default: 30 },
  currentDay: { type: Number, default: 1 },
  commitsPerDay: { type: Number, default: 2 },
  cronTime: { type: String, default: '10:00' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  committerName: { type: String, default: 'GitStreak Bot' },
  committerEmail: { type: String, default: 'gitstreak@automation.local' },
  status: { type: String, default: 'active' }, // active, paused, completed, error
  plan: { type: Array, default: [] },
  commitsHistory: { type: Array, default: [] },
  lastRunAt: { type: String, default: null },
  lastRunStatus: { type: String, default: null },
  errorMessage: { type: String, default: null },
  totalCommitsPushed: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const LogSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  campaignId: { type: String, index: true },
  level: { type: String, default: 'info' },
  message: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  timestamp: { type: String, default: () => new Date().toISOString() }
});

let UserModel;
let CampaignModel;
let LogModel;

// ----------------- LOCAL JSON STORE FALLBACK -----------------
let localCache = {
  users: [],
  campaigns: [],
  logs: []
};

let isWriting = false;
let pendingWrite = false;

function initLocalStore() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      localCache = JSON.parse(raw);
      if (!Array.isArray(localCache.users)) localCache.users = [];
      if (!Array.isArray(localCache.campaigns)) localCache.campaigns = [];
      if (!Array.isArray(localCache.logs)) localCache.logs = [];
    } else {
      flushSync();
    }
  } catch (err) {
    console.error('[DB] Failed to init local DB:', err.message);
  }
}

function flushSync() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(localCache, null, 2), 'utf-8');
  fs.renameSync(tempFile, DATA_FILE);
}

async function persistLocal() {
  if (isWriting) {
    pendingWrite = true;
    return;
  }
  isWriting = true;
  try {
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    await fs.promises.writeFile(tempFile, JSON.stringify(localCache, null, 2), 'utf-8');
    await fs.promises.rename(tempFile, DATA_FILE);
  } catch (err) {
    console.error('[DB] Local write error:', err);
  } finally {
    isWriting = false;
    if (pendingWrite) {
      pendingWrite = false;
      await persistLocal();
    }
  }
}

// ----------------- INITIALIZE CONNECTION -----------------
async function initDatabase() {
  initLocalStore();

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      console.log('[DB] Connecting to MongoDB...');
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000
      });
      UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
      CampaignModel = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
      LogModel = mongoose.models.Log || mongoose.model('Log', LogSchema);
      isMongoActive = true;
      console.log('✅ [DB] Successfully connected to MongoDB Atlas!');
    } catch (err) {
      console.warn(`⚠️ [DB] MongoDB connection failed (${err.message}). Using local JSON storage fallback.`);
      isMongoActive = false;
    }
  } else {
    console.log('[DB] No MONGODB_URI provided. Running on persistent local storage.');
  }
}

initDatabase();

module.exports = {
  isMongoConnected() {
    return isMongoActive;
  },

  // ----------------- USER AUTH METHODS -----------------
  async findOrCreateUser({ githubId, username, displayName, avatarUrl, email, accessToken }) {
    if (isMongoActive && UserModel) {
      let user = await UserModel.findOne({ githubId: String(githubId) });
      if (!user) {
        user = new UserModel({
          id: uuidv4(),
          githubId: String(githubId),
          username,
          displayName: displayName || username,
          avatarUrl,
          email,
          accessToken,
          updatedAt: new Date()
        });
      } else {
        user.username = username;
        user.displayName = displayName || username;
        user.avatarUrl = avatarUrl;
        if (email) user.email = email;
        user.accessToken = accessToken;
        user.updatedAt = new Date();
      }
      await user.save();
      return user.toObject();
    }

    // Local JSON Fallback
    let user = localCache.users.find(u => String(u.githubId) === String(githubId));
    if (!user) {
      user = {
        id: uuidv4(),
        githubId: String(githubId),
        username,
        displayName: displayName || username,
        avatarUrl,
        email,
        accessToken,
        geminiApiKey: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      localCache.users.unshift(user);
    } else {
      user.username = username;
      user.displayName = displayName || username;
      user.avatarUrl = avatarUrl;
      if (email) user.email = email;
      user.accessToken = accessToken;
      user.updatedAt = new Date().toISOString();
    }
    await persistLocal();
    return user;
  },

  async getUserById(id) {
    if (isMongoActive && UserModel) {
      const user = await UserModel.findOne({ id }).lean();
      return user;
    }
    return localCache.users.find(u => u.id === id) || null;
  },

  async updateUserGeminiKey(userId, geminiApiKey) {
    if (isMongoActive && UserModel) {
      await UserModel.updateOne({ id: userId }, { geminiApiKey, updatedAt: new Date() });
      return;
    }
    const user = localCache.users.find(u => u.id === userId);
    if (user) {
      user.geminiApiKey = geminiApiKey;
      user.updatedAt = new Date().toISOString();
      await persistLocal();
    }
  },

  // ----------------- CAMPAIGN METHODS -----------------
  async getAllCampaigns(userId = null, username = null) {
    if (!userId && !username) {
      return []; // Strict protection: unauthenticated users cannot view other people's campaigns
    }

    if (isMongoActive && CampaignModel) {
      const conditions = [];
      if (userId) conditions.push({ userId });
      if (username) conditions.push({ repoOwner: new RegExp(`^${username}$`, 'i') });
      const query = conditions.length > 1 ? { $or: conditions } : conditions[0];
      const list = await CampaignModel.find(query).sort({ createdAt: -1 }).lean();
      return list;
    }

    return localCache.campaigns.filter(c => {
      if (userId && c.userId === userId) return true;
      if (username && c.repoOwner && c.repoOwner.toLowerCase() === username.toLowerCase()) return true;
      return false;
    });
  },

  async getAllCampaignsForScheduler() {
    if (isMongoActive && CampaignModel) {
      return await CampaignModel.find({}).lean();
    }
    return [...localCache.campaigns];
  },

  async getCampaign(id) {
    if (isMongoActive && CampaignModel) {
      return await CampaignModel.findOne({ id }).lean();
    }
    return localCache.campaigns.find(c => c.id === id) || null;
  },

  async createCampaign(data) {
    const now = new Date().toISOString();
    const newCampaign = {
      id: uuidv4(),
      userId: data.userId || null,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      projectName: data.projectName || 'Untitled Project',
      projectDescription: data.projectDescription || '',
      repoUrl: data.repoUrl,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
      branch: data.branch || 'main',
      githubToken: data.githubToken,
      geminiApiKey: data.geminiApiKey || '',
      totalDays: Number(data.totalDays) || 30,
      currentDay: Number(data.currentDay) || 1,
      commitsPerDay: Number(data.commitsPerDay) || 2,
      cronTime: data.cronTime || '10:00',
      timezone: data.timezone || 'Asia/Kolkata',
      committerName: data.committerName || 'GitStreak Bot',
      committerEmail: data.committerEmail || 'gitstreak@automation.local',
      plan: Array.isArray(data.plan) ? data.plan : [],
      commitsHistory: [],
      lastRunAt: null,
      lastRunStatus: null,
      errorMessage: null,
      totalCommitsPushed: 0
    };

    if (isMongoActive && CampaignModel) {
      const doc = new CampaignModel(newCampaign);
      await doc.save();
      return doc.toObject();
    }

    localCache.campaigns.unshift(newCampaign);
    await persistLocal();
    return newCampaign;
  },

  async updateCampaign(id, updates) {
    const updatedPayload = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (isMongoActive && CampaignModel) {
      const doc = await CampaignModel.findOneAndUpdate({ id }, { $set: updatedPayload }, { new: true }).lean();
      return doc;
    }

    const idx = localCache.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return null;

    localCache.campaigns[idx] = {
      ...localCache.campaigns[idx],
      ...updatedPayload
    };

    await persistLocal();
    return localCache.campaigns[idx];
  },

  async deleteCampaign(id) {
    if (isMongoActive && CampaignModel) {
      await CampaignModel.deleteOne({ id });
      if (LogModel) await LogModel.deleteMany({ campaignId: id });
      return true;
    }

    const idx = localCache.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return false;

    localCache.campaigns.splice(idx, 1);
    localCache.logs = localCache.logs.filter(l => l.campaignId !== id);
    await persistLocal();
    return true;
  },

  // ----------------- LOGGING METHODS -----------------
  async addLog(campaignId, level = 'info', message = '', metadata = null) {
    const entry = {
      id: uuidv4(),
      campaignId,
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata
    };

    if (isMongoActive && LogModel) {
      const doc = new LogModel(entry);
      await doc.save();
      return doc.toObject();
    }

    localCache.logs.unshift(entry);
    if (localCache.logs.length > 1000) {
      localCache.logs = localCache.logs.slice(0, 1000);
    }
    await persistLocal();
    return entry;
  },

  async getLogs(campaignId, limit = 50) {
    if (isMongoActive && LogModel) {
      const query = campaignId ? { campaignId } : {};
      return await LogModel.find(query).sort({ timestamp: -1 }).limit(limit).lean();
    }

    const filtered = campaignId
      ? localCache.logs.filter(l => l.campaignId === campaignId)
      : localCache.logs;
    return filtered.slice(0, limit);
  },

  async recordCommit(campaignId, commitRecord) {
    if (isMongoActive && CampaignModel) {
      const doc = await CampaignModel.findOneAndUpdate(
        { id: campaignId },
        {
          $push: { commitsHistory: { $each: [commitRecord], $position: 0 } },
          $inc: { totalCommitsPushed: 1 },
          $set: { updatedAt: new Date().toISOString() }
        },
        { new: true }
      ).lean();
      return doc;
    }

    const campaign = localCache.campaigns.find(c => c.id === campaignId);
    if (!campaign) return null;

    if (!Array.isArray(campaign.commitsHistory)) {
      campaign.commitsHistory = [];
    }
    campaign.commitsHistory.unshift(commitRecord);
    campaign.totalCommitsPushed = (campaign.totalCommitsPushed || 0) + 1;
    campaign.updatedAt = new Date().toISOString();
    await persistLocal();
    return campaign;
  }
};
