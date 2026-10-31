const db = require('./db');
const github = require('./github');
const gemini = require('./gemini');

/**
 * Helper to convert snake/kebab case to PascalCase
 */
function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, chr => chr.toUpperCase()) || 'AppModule';
}

/**
 * Resilient fallback commit generator:
 * Produces realistic, syntax-valid project source files and tests matching the day's milestone.
 * Guarantees that the GitHub streak is 100% safeguarded even if Gemini encounters a quota limit,
 * network timeout, or if no API key was provided.
 */
function generateResilientCommits({
  projectName,
  description,
  currentDay,
  totalDays,
  dayMilestone,
  commitsCount = 2,
  existingFiles = []
}) {
  const safeName = (projectName || 'project').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const slug = (dayMilestone || 'core_feature')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'feature';
  const className = toPascalCase(slug);

  const commits = [];

  // Commit 1: Core Implementation / Scaffolding
  if (currentDay === 1 && (!existingFiles || existingFiles.length === 0)) {
    commits.push({
      commitMessage: `feat(init): scaffold ${safeName} and configure baseline environment`,
      files: [
        {
          path: 'package.json',
          content: JSON.stringify(
            {
              name: safeName,
              version: '0.1.0',
              description: description || `${projectName} application`,
              main: 'src/index.js',
              scripts: {
                start: 'node src/index.js',
                test: 'node --test tests/'
              },
              keywords: ['gitstreak', 'automated', safeName]
            },
            null,
            2
          ) + '\n'
        },
        {
          path: '.gitignore',
          content: 'node_modules/\n.env\n*.log\ncoverage/\n.DS_Store\n'
        },
        {
          path: 'README.md',
          content: [
            `# ${projectName}`,
            '',
            `> ${description || 'Autonomous development project built daily with GitStreak.'}`,
            '',
            '## 🚀 Development Roadmap',
            `- [x] **Day 1**: ${dayMilestone}`,
            `<!-- gitstreak-roadmap-end -->`,
            '',
            '## 📦 Getting Started',
            '```bash',
            'npm install',
            'npm start',
            '```'
          ].join('\n') + '\n'
        },
        {
          path: 'src/index.js',
          content: [
            `/**`,
            ` * ${projectName} - Core Application Entrypoint`,
            ` * Day 1: ${dayMilestone}`,
            ` */`,
            `console.log("🚀 Initializing ${projectName}...");`,
            ``,
            `module.exports = {`,
            `  name: "${projectName}",`,
            `  version: "0.1.0",`,
            `  status: "initialized"`,
            `};`,
            ``
          ].join('\n')
        }
      ]
    });
  } else {
    // Standard Day 2+ Feature Implementation
    commits.push({
      commitMessage: `feat(day-${currentDay}): implement ${dayMilestone.toLowerCase().slice(0, 50)}`,
      files: [
        {
          path: `src/features/${slug}.js`,
          content: [
            `/**`,
            ` * ${projectName} - Day ${currentDay} of ${totalDays}`,
            ` * Milestone: ${dayMilestone}`,
            ` */`,
            ``,
            `class ${className} {`,
            `  constructor(config = {}) {`,
            `    this.config = config;`,
            `    this.initializedAt = new Date();`,
            `    this.status = 'active';`,
            `  }`,
            ``,
            `  /**`,
            `   * Executes the ${dayMilestone} operation`,
            `   */`,
            `  async execute(input = {}) {`,
            `    return {`,
            `      success: true,`,
            `      day: ${currentDay},`,
            `      milestone: "${dayMilestone}",`,
            `      timestamp: new Date().toISOString(),`,
            `      data: input`,
            `    };`,
            `  }`,
            `}`,
            ``,
            `module.exports = { ${className} };`,
            ``
          ].join('\n')
        },
        {
          path: `docs/milestones/day-${currentDay}.md`,
          content: [
            `# Day ${currentDay}: ${dayMilestone}`,
            ``,
            `- **Project**: ${projectName}`,
            `- **Progress**: Day ${currentDay} of ${totalDays}`,
            `- **Status**: Completed`,
            `- **Timestamp**: ${new Date().toISOString()}`,
            ``,
            `## Summary`,
            `Completed the core implementation for "${dayMilestone}".`,
            `Exported \`${className}\` in \`src/features/${slug}.js\`.`
          ].join('\n') + '\n'
        }
      ]
    });
  }

  // Commit 2: Automated Tests & Validation Suite
  if (commitsCount >= 2) {
    commits.push({
      commitMessage: `test(day-${currentDay}): add automated unit tests and validation for ${slug}`,
      files: [
        {
          path: `tests/${slug}.test.js`,
          content: [
            `const assert = require('assert');`,
            `const { ${className} } = require('../src/features/${slug}');`,
            ``,
            `// Test suite for Day ${currentDay} (${dayMilestone})`,
            `async function runTests() {`,
            `  const instance = new ${className}();`,
            `  assert.strictEqual(instance.status, 'active', 'Service should be active');`,
            `  `,
            `  const res = await instance.execute({ test: true });`,
            `  assert.strictEqual(res.success, true, 'Execution should succeed');`,
            `  assert.strictEqual(res.day, ${currentDay}, 'Day should match ${currentDay}');`,
            `  console.log('✅ [PASSED] Day ${currentDay} test suite for ${className}');`,
            `}`,
            ``,
            `if (require.main === module) {`,
            `  runTests().catch(err => {`,
            `    console.error(err);`,
            `    process.exit(1);`,
            `  });`,
            `}`,
            ``,
            `module.exports = { runTests };`,
            ``
          ].join('\n')
        }
      ]
    });
  }

  // Commit 3: Documentation Specifications (if 3+ commits requested)
  if (commitsCount >= 3) {
    commits.push({
      commitMessage: `docs(api): document specifications and usage for ${slug}`,
      files: [
        {
          path: `docs/specs/${slug}-spec.md`,
          content: [
            `# Specification: ${className}`,
            ``,
            `## Overview`,
            `Documentation for \`${className}\` implemented on Day ${currentDay}.`,
            ``,
            `\`\`\`javascript`,
            `const { ${className} } = require('./src/features/${slug}');`,
            `const service = new ${className}();`,
            `const result = await service.execute();`,
            `console.log(result.success);`,
            `\`\`\``
          ].join('\n') + '\n'
        }
      ]
    });
  }

  return commits.slice(0, commitsCount);
}

/**
 * Runs the daily streak automation for a specific campaign.
 * Can be triggered automatically by cron or manually from the dashboard.
 */
async function runCampaignDay(campaignId, isManual = false) {
  const campaign = await db.getCampaign(campaignId);
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
    let generatedCommits = null;
    const apiKey = campaign.geminiApiKey || process.env.GEMINI_API_KEY;

    if (apiKey) {
      await db.addLog(campaignId, 'info', `🤖 Prompting Gemini AI to generate ${commitsCount} semantic commits for Day ${currentDay}...`);
      try {
        generatedCommits = await gemini.generateDailyCode({
          apiKey,
          projectName: campaign.projectName,
          description: campaign.projectDescription,
          currentDay,
          totalDays,
          dayMilestone,
          commitsCount,
          existingFiles
        });
        await db.addLog(campaignId, 'info', `Gemini AI successfully generated ${generatedCommits.length} commits.`);
      } catch (aiErr) {
        console.warn(`[StreakRunner] Gemini generation note: ${aiErr.message}. Utilizing autonomous resilient generator.`);
        await db.addLog(campaignId, 'warn', `⚠️ Gemini AI note: ${aiErr.message}. Activating autonomous resilient generator to guarantee GitHub streak.`);
      }
    } else {
      await db.addLog(campaignId, 'info', `ℹ️ No Gemini API Key set. Activating autonomous resilient generator.`);
    }

    // Resilient Fallback: If Gemini is unavailable, rate-limited, or failed, generate realistic code so the streak is 100% safeguarded!
    if (!generatedCommits || !Array.isArray(generatedCommits) || generatedCommits.length === 0) {
      generatedCommits = generateResilientCommits({
        projectName: campaign.projectName,
        description: campaign.projectDescription,
        currentDay,
        totalDays,
        dayMilestone,
        commitsCount,
        existingFiles
      });
      await db.addLog(campaignId, 'info', `Generated ${generatedCommits.length} resilient commits for Day ${currentDay}.`);
    }

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
  runCampaignDay,
  generateResilientCommits
};
