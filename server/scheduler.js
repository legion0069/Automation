const cron = require('node-cron');
const db = require('./db');
const streakRunner = require('./streakRunner');

let isMasterRunning = false;

/**
 * Checks if a campaign has already succeeded today in its configured timezone.
 * Requires lastRunStatus to be 'success' so failed attempts can be retried.
 */
function hasRunSuccessfullyToday(campaign, timezone = 'Asia/Kolkata') {
  if (!campaign) return false;
  const lastRunAt = typeof campaign === 'object' ? campaign.lastRunAt : campaign;
  const lastRunStatus = typeof campaign === 'object' ? campaign.lastRunStatus : 'success';

  if (!lastRunAt) return false;
  if (lastRunStatus && lastRunStatus !== 'success') return false;

  try {
    const nowStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const lastRunStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(lastRunAt));

    return nowStr === lastRunStr;
  } catch {
    return false;
  }
}

/**
 * Backwards-compatible alias for hasRunSuccessfullyToday
 */
function hasRunToday(campaignOrLastRunAt, timezone = 'Asia/Kolkata') {
  return hasRunSuccessfullyToday(campaignOrLastRunAt, timezone);
}

/**
 * Gets the current HH:MM in a specific timezone
 */
function getCurrentTimeInTimezone(timezone = 'Asia/Kolkata') {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());
    return parts; // e.g. "16:00"
  } catch {
    return '00:00';
  }
}

/**
 * Checks whether a campaign is due right now:
 * 1. Campaign is active
 * 2. Has NOT already succeeded today in its timezone
 * 3. Has reached or passed the scheduled time (>= scheduledTime, e.g. 16:00)
 */
function isCampaignDue(campaign) {
  if (!campaign || campaign.status !== 'active') return false;

  const tz = campaign.timezone || 'Asia/Kolkata';
  if (hasRunSuccessfullyToday(campaign, tz)) {
    return false; // Already finished today's streak
  }

  const scheduledTime = campaign.cronTime || '16:00';
  const currentTime = getCurrentTimeInTimezone(tz);

  // e.g. "16:00" >= "16:00", or "16:30" >= "16:00" (catch-up if server was asleep at 16:00)
  return currentTime >= scheduledTime;
}

/**
 * Evaluates all active campaigns and runs any that are due right now (including catch-up)
 */
async function processDueCampaigns() {
  if (isMasterRunning) return;
  isMasterRunning = true;

  try {
    const campaigns = await db.getAllCampaignsForScheduler();
    const activeCampaigns = campaigns.filter(c => c.status === 'active');

    for (const campaign of activeCampaigns) {
      const tz = campaign.timezone || 'Asia/Kolkata';
      const scheduledTime = campaign.cronTime || '16:00';
      const currentTime = getCurrentTimeInTimezone(tz);

      if (isCampaignDue(campaign)) {
        console.log(`[Scheduler] 🚀 Executing due campaign "${campaign.projectName}" (Time: ${currentTime} ${tz}, Scheduled: ${scheduledTime})`);
        try {
          await streakRunner.runCampaignDay(campaign.id, false);
          console.log(`[Scheduler] ✅ Successfully completed daily run for "${campaign.projectName}".`);
        } catch (err) {
          console.error(`[Scheduler] ❌ Error running campaign "${campaign.projectName}":`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error in processDueCampaigns:', err);
  } finally {
    isMasterRunning = false;
  }
}

/**
 * Starts the background cron scheduler.
 * - Dedicated 4:00 PM IST daily trigger
 * - Minutely heartbeat for catch-up execution & custom times
 * - Immediate startup catch-up execution
 */
function startScheduler() {
  console.log('[Scheduler] Initializing GitStreak Cron Scheduler...');
  console.log('[Scheduler] Default schedule: Daily at 16:00 (4:00 PM) IST [Asia/Kolkata]');

  // Dedicated 4:00 PM IST trigger: "0 16 * * *" in Asia/Kolkata
  cron.schedule(
    '0 16 * * *',
    async () => {
      console.log('[Scheduler] ⏰ 4:00 PM IST Reached! Running active daily campaigns...');
      await processDueCampaigns();
    },
    {
      timezone: 'Asia/Kolkata'
    }
  );

  // Minutely heartbeat checker (runs catch-up if server was asleep at 16:00 on Render free tier)
  cron.schedule('* * * * *', async () => {
    await processDueCampaigns();
  });

  // Immediate catch-up check on server boot/wake-up
  setTimeout(async () => {
    console.log('[Scheduler] Checking for any pending/due campaigns on server boot...');
    await processDueCampaigns();
  }, 3000);

  console.log('[Scheduler] Background cron jobs & catch-up recovery scheduled successfully.');
}

/**
 * External webhook trigger for cron-job.org or other webcron services.
 * Executes active campaigns.
 */
async function triggerCronJobWebhook({ force = false, campaignId = null }) {
  const campaigns = await db.getAllCampaignsForScheduler();
  const targets = campaignId
    ? campaigns.filter(c => c.id === campaignId)
    : campaigns.filter(c => c.status === 'active');

  const results = [];

  for (const campaign of targets) {
    const tz = campaign.timezone || 'Asia/Kolkata';
    const alreadyRun = hasRunSuccessfullyToday(campaign, tz);

    if (alreadyRun && !force) {
      results.push({
        campaignId: campaign.id,
        projectName: campaign.projectName,
        status: 'skipped',
        reason: 'Already successfully completed today in timezone ' + tz
      });
      continue;
    }

    try {
      console.log(`[cron-job.org] Executing campaign "${campaign.projectName}" (Day ${campaign.currentDay})...`);
      const res = await streakRunner.runCampaignDay(campaign.id, force);
      results.push({
        campaignId: campaign.id,
        projectName: campaign.projectName,
        status: 'success',
        dayCompleted: res.dayCompleted,
        commitsPushed: res.commits?.length || 0
      });
    } catch (err) {
      results.push({
        campaignId: campaign.id,
        projectName: campaign.projectName,
        status: 'error',
        error: err.message
      });
    }
  }

  return results;
}

module.exports = {
  startScheduler,
  processDueCampaigns,
  hasRunToday,
  hasRunSuccessfullyToday,
  isCampaignDue,
  getCurrentTimeInTimezone,
  triggerCronJobWebhook
};

