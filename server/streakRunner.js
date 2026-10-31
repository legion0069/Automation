const db = require('./db');
const github = require('./github');
const gemini = require('./gemini');

/**
 * Runs the daily streak automation for a specific campaign.
 * Can be triggered automatically by cron or manually from the dashboard.
 */
async function runCampaignDay(campaignId, isManual = false) {
  const campaign = db.getCampaign(campaignId);
  if (!campaign) {
    throw new Error(`Campaign with ID ${campaignId} not found.`);
  }

  if (campaign.status === 'paused' && !isManual) {
    await db.addLog(campaignId, 'info', 'Campaign is paused. Skipping scheduled run.');
    return { skipped: true, reason: 'Campaign is paused' };
  }

  if (campaign.status === 'completed') {
    await db.addLog(campaignId, 'info', 'Campaign has already reached total days. Skipping.');
    return { skipped: true, reason: 'Campaign completed' };
  }

  const currentDay = campaign.currentDay || 1;
  const totalDays = campaign.totalDays || 30;

  await db.addLog(
    campaignId,
    'info',
    `🚀 Starting ${isManual ? 'manual' : 'scheduled'} execution for Day ${currentDay} of ${totalDays}: "${campaign.projectName}"`
  );

  try {
    // Determine today's milestone
    let dayMilestone = `Build core components and write tests for Day ${currentDay}`;
    if (Array.isArray(campaign.plan) && campaign.plan.length >= currentDay) {
      const planItem = campaign.plan[currentDay - 1];
      if (typeof planItem === 'string') {
        dayMilestone = planItem;
      } else if (planItem?.title) {
        dayMilestone = `${planItem.title}: ${planItem.description || ''}`;
      }
    }

    await db.addLog(campaignId, 'info', `Target milestone: ${dayMilestone}`);

    // Fetch existing repo file structure for context
    let existingFiles = [];
    try {
      existingFiles = await github.getRepoTreeOverview({
        token: campaign.githubToken,
        owner: campaign.repoOwner,
        repo: campaign.repoName,
        branch: campaign.branch || 'main'
      });
      await db.addLog(campaignId, 'info', `Inspected repository tree: found ${existingFiles.length} existing files.`);
    } catch (treeErr) {
      await db.addLog(campaignId, 'warn', `Note: Could not inspect repository tree (repo may be empty): ${treeErr.message}`);
    }

    // Call Gemini to generate commits & code
    const commitsCount = Math.max(1, Math.min(10, campaign.commitsPerDay || 2));
    await db.addLog(campaignId, 'info', `🤖 Prompting Gemini AI to generate ${commitsCount} semantic commits for Day ${currentDay}...`);

    const generatedCommits = await gemini.generateDailyCode({
      apiKey: campaign.geminiApiKey || process.env.GEMINI_API_KEY,
      projectName: campaign.projectName,
      description: campaign.projectDescription,
      currentDay,
      totalDays,
      dayMilestone,
      commitsCount,
      existingFiles
    });

    await db.addLog(campaignId, 'info', `Gemini successfully generated ${generatedCommits.length} commits. Pushing to GitHub...`);

    const pushedRecords = [];

    // Push each commit to GitHub
    for (let i = 0; i < generatedCommits.length; i++) {
      const item = generatedCommits[i];
      await db.addLog(campaignId, 'info', `Pushing commit ${i + 1}/${generatedCommits.length}: "${item.commitMessage}" (${item.files.length} files)`);

      const pushRes = await github.pushCommitWithFiles({
        token: campaign.githubToken,
        owner: campaign.repoOwner,
        repo: campaign.repoName,
        branch: campaign.branch || 'main',
        message: item.commitMessage,
        files: item.files,
        author: {
          name: campaign.committerName || 'GitStreak Bot',
          email: campaign.committerEmail || 'gitstreak@automation.local'
        }
      });

      const commitRecord = {
        sha: pushRes.commitSha,
        htmlUrl: pushRes.htmlUrl,
        message: item.commitMessage,
        filesPushed: pushRes.filesPushed,
        day: currentDay,
        timestamp: new Date().toISOString()
      };

      await db.recordCommit(campaignId, commitRecord);
      pushedRecords.push(commitRecord);

      await db.addLog(campaignId, 'success', `✅ Commit pushed: ${pushRes.commitSha.substring(0, 7)} - ${item.commitMessage}`, {
        url: pushRes.htmlUrl
      });

      // Brief delay between multiple commits for realistic spacing
      if (i < generatedCommits.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Advance Day
    const nextDay = currentDay + 1;
    const isCompleted = nextDay > totalDays;

    await db.updateCampaign(campaignId, {
      currentDay: nextDay,
      status: isCompleted ? 'completed' : 'active',
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'success',
      errorMessage: null
    });

    const completionMsg = isCompleted
      ? `🎉 Campaign Completed! All ${totalDays} days finished.`
      : `🌟 Day ${currentDay} complete! Advanced to Day ${nextDay}/${totalDays}.`;

    await db.addLog(campaignId, 'success', completionMsg);

    return {
      success: true,
      dayCompleted: currentDay,
      nextDay,
      isCompleted,
      commits: pushedRecords
    };
  } catch (err) {
    console.error(`[StreakRunner Error on ${campaignId}]:`, err);
    await db.updateCampaign(campaignId, {
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'error',
      errorMessage: err.message
    });
    await db.addLog(campaignId, 'error', `❌ Execution failed for Day ${currentDay}: ${err.message}`);
    throw err;
  }
}

module.exports = {
  runCampaignDay
};
