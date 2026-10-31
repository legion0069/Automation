const cron = require('node-cron');
const db = require('./db');
const streakRunner = require('./streakRunner');

let isMasterRunning = false;

/**
 * Checks if a campaign has already run today in its configured timezone
 */
function hasRunToday(lastRunAt, timezone = 'Asia/Kolkata') {
  if (!lastRunAt) return false;
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
    return parts; // e.g. "18:00"
  } catch {
    return '00:00';
  }
}

/**
 * Evaluates all active campaigns and runs any that are due right now
 */
async function processDueCampaigns() {
  if (isMasterRunning) return;
  isMasterRunning = true;

  try {
    const campaigns = await db.getAllCampaignsForScheduler();
    const activeCampaigns = campaigns.filter(c => c.status === 'active');

    for (const campaign of activeCampaigns) {
      const tz = campaign.timezone || 'Asia/Kolkata';
      const scheduledTime = campaign.cronTime || '18:00';
      const currentTime = getCurrentTimeInTimezone(tz);

      // Check if scheduled minute matches current minute
      if (currentTime === scheduledTime) {
        if (!hasRunToday(campaign.lastRunAt, tz)) {
          console.log(`[Scheduler] Triggering campaign "${campaign.projectName}" at ${currentTime} ${tz}`);
          try {
            await streakRunner.runCampaignDay(campaign.id, false);
          } catch (err) {
            console.error(`[Scheduler] Error running campaign ${campaign.id}:`, err.message);
          }
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
 * Runs every minute to accurately match configured timezones.
 * Also sets up a dedicated hook for 6:00 PM IST (18:00) daily.
 */
function startScheduler() {
  console.log('[Scheduler] Initializing GitStreak Cron Scheduler...');
  console.log('[Scheduler] Default schedule: Daily at 18:00 (6:00 PM) IST [Asia/Kolkata]');

  // Dedicated 6:00 PM IST trigger: "0 18 * * *" in Asia/Kolkata
  cron.schedule(
    '0 18 * * *',
    async () => {
      console.log('[Scheduler] ⏰ 6:00 PM IST Reached! Checking active campaigns...');
      await processDueCampaigns();
    },
    {
      timezone: 'Asia/Kolkata'
    }
  );

  // Minutely heartbeat checker (catches campaigns with custom times or recovery)
  cron.schedule('* * * * *', async () => {
    await processDueCampaigns();
  });

  console.log('[Scheduler] Background cron jobs scheduled successfully.');
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
    const alreadyRun = hasRunToday(campaign.lastRunAt, tz);

    if (alreadyRun && !force) {
      results.push({
        campaignId: campaign.id,
        projectName: campaign.projectName,
        status: 'skipped',
        reason: 'Already executed today in timezone ' + tz
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
  getCurrentTimeInTimezone,
  triggerCronJobWebhook
};

