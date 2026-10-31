/**
 * GitStreak AI - Standalone GitHub Actions Runner
 * 
 * Runs automatically inside GitHub Actions:
 * - Detects or initializes project roadmap
 * - Generates daily source code & tests using Google Gemini AI (with autonomous resilient fallback)
 * - Writes files, updates README, and pushes semantic commits to GitHub
 * - Guaranteed unbroken daily green contribution streaks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ----------------- CONFIGURATION & ENVIRONMENT -----------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.TARGET_TOKEN || '';
const GITHUB_ACTOR = process.env.GITHUB_ACTOR || 'gitstreak-bot';
const TARGET_REPO = process.env.TARGET_REPO || ''; // Optional: e.g. "legion0069/to-do-list"
const COMMITS_PER_DAY = Math.max(1, Math.min(5, parseInt(process.env.COMMITS_PER_DAY || '2', 10)));
const FORCE_RUN = process.env.FORCE_RUN === 'true' || process.env.INPUT_FORCE === 'true';

// Preferred Gemini models (ordered by speed and capability)
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

// Helper to run shell commands
function runCmd(cmd, cwd = process.cwd()) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`Command failed [${cmd}]: ${stderr}`);
  }
}

// Helper to convert string to PascalCase
function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, chr => chr.toUpperCase()) || 'Module';
}

// ----------------- GEMINI AI CLIENT -----------------
async function callGemini({ apiKey, prompt, systemInstruction = '' }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      };

      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // Retry without responseMimeType if 400
      if (!res.ok && res.status === 400) {
        delete body.generationConfig.responseMimeType;
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 404 || errorText.includes('not found') || errorText.includes('NOT_FOUND')) {
          continue; // Try next model
        }
        throw new Error(`Gemini ${model} HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');
      return text;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini candidate models failed.');
}

// Lenient JSON parser that handles code strings with unescaped newlines
function parseLenientJson(str) {
  if (!str) return null;
  const trimmed = str.trim();

  // Try direct parse
  try { return JSON.parse(trimmed); } catch {}

  // Strip markdown fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Bracket extraction
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start !== -1 && end > start) {
    const sub = trimmed.substring(start, end + 1).replace(/,\s*([\]}])/g, '$1');
    try { return JSON.parse(sub); } catch {}
  }

  return null;
}

// ----------------- AUTONOMOUS RESILIENT CODE GENERATOR -----------------
function generateResilientDayCode({ projectName, dayNumber, totalDays, milestone, commitsCount }) {
  const safeName = (projectName || 'app').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const slug = (milestone || `day_${dayNumber}_feature`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'feature';
  const className = toPascalCase(slug);

  const commits = [];

  // Commit 1: Core Implementation
  if (dayNumber === 1) {
    commits.push({
      message: `feat(init): scaffold ${safeName} and configure baseline environment`,
      files: [
        {
          path: 'package.json',
          content: JSON.stringify(
            {
              name: safeName,
              version: '0.1.0',
              description: `${projectName} - Built with autonomous daily milestones`,
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
          path: 'src/index.js',
          content: [
            `/**`,
            ` * ${projectName} - Core Application Entrypoint`,
            ` * Milestone: ${milestone}`,
            ` */`,
            `console.log("🚀 ${projectName} Initialized (Day 1)");`,
            ``,
            `module.exports = {`,
            `  name: "${projectName}",`,
            `  day: 1,`,
            `  status: "active"`,
            `};`,
            ``
          ].join('\n')
        }
      ]
    });
  } else {
    commits.push({
      message: `feat(day-${dayNumber}): implement ${milestone.toLowerCase().slice(0, 50)}`,
      files: [
        {
          path: `src/features/${slug}.js`,
          content: [
            `/**`,
            ` * ${projectName} - Day ${dayNumber} of ${totalDays}`,
            ` * Milestone: ${milestone}`,
            ` */`,
            ``,
            `class ${className} {`,
            `  constructor(config = {}) {`,
            `    this.config = config;`,
            `    this.createdAt = new Date();`,
            `    this.status = 'ready';`,
            `  }`,
            ``,
            `  /**`,
            `   * Executes the ${milestone} capability`,
            `   */`,
            `  async execute(payload = {}) {`,
            `    return {`,
            `      success: true,`,
            `      day: ${dayNumber},`,
            `      milestone: "${milestone}",`,
            `      timestamp: new Date().toISOString(),`,
            `      data: payload`,
            `    };`,
            `  }`,
            `}`,
            ``,
            `module.exports = { ${className} };`,
            ``
          ].join('\n')
        },
        {
          path: `docs/milestones/day-${dayNumber}.md`,
          content: [
            `# Day ${dayNumber}: ${milestone}`,
            ``,
            `- **Project**: ${projectName}`,
            `- **Progress**: Day ${dayNumber} of ${totalDays}`,
            `- **Status**: Completed`,
            `- **Timestamp**: ${new Date().toISOString()}`,
            ``,
            `## Summary`,
            `Implemented core module for \`${milestone}\` in \`src/features/${slug}.js\`.`
          ].join('\n') + '\n'
        }
      ]
    });
  }

  // Commit 2: Automated Tests
  if (commitsCount >= 2) {
    commits.push({
      message: `test(day-${dayNumber}): add automated test suites for ${slug}`,
      files: [
        {
          path: `tests/${slug}.test.js`,
          content: [
            `const assert = require('assert');`,
            `const { ${className} } = require('../src/features/${slug}');`,
            ``,
            `// Automated Unit Test Suite for Day ${dayNumber} (${milestone})`,
            `async function runTests() {`,
            `  const instance = new ${className}();`,
            `  assert.strictEqual(instance.status, 'ready', 'Instance should be in ready state');`,
            `  const result = await instance.execute({ testRun: true });`,
            `  assert.strictEqual(result.success, true, 'Execution should return success: true');`,
            `  assert.strictEqual(result.day, ${dayNumber}, 'Result day should match');`,
            `  console.log('✅ [PASS] All tests passed for Day ${dayNumber}: ${milestone}');`,
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

  return commits.slice(0, commitsCount);
}

// ----------------- MAIN EXECUTION ENGINE -----------------
async function main() {
  console.log('========================================================');
  console.log('🚀 GitStreak AI - Standalone GitHub Actions Streak Runner');
  console.log('========================================================');

  let workingDir = process.cwd();

  // If TARGET_REPO is specified (e.g. "legion0069/to-do-list"), clone and work inside it
  if (TARGET_REPO) {
    console.log(`🎯 TARGET_REPO detected: ${TARGET_REPO}`);
    const token = GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN or TARGET_TOKEN is required to push to target repository.');

    const tempDir = path.join(process.cwd(), '.gitstreak-target-workspace');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log(`Cloning https://github.com/${TARGET_REPO}.git into workspace...`);
    const cloneUrl = `https://x-access-token:${token}@github.com/${TARGET_REPO}.git`;
    runCmd(`git clone ${cloneUrl} ${tempDir}`);
    workingDir = tempDir;
  }

  // State management inside working directory: .gitstreak/
  const stateDir = path.join(workingDir, '.gitstreak');
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  const stateFile = path.join(stateDir, 'state.json');
  let state = {
    projectName: path.basename(workingDir),
    totalDays: 30,
    currentDay: 1,
    lastRunDate: null,
    history: []
  };

  if (fs.existsSync(stateFile)) {
    try {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch {}
  }

  // Get repository name from package.json or folder name
  const pkgFile = path.join(workingDir, 'package.json');
  if (fs.existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
      if (pkg.name) state.projectName = pkg.name;
    } catch {}
  }

  // Check if already completed today in IST
  const todayIst = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  if (state.lastRunDate === todayIst && !FORCE_RUN) {
    console.log(`ℹ️ Day ${state.currentDay} streak was already completed today (${todayIst} IST).`);
    console.log('Set FORCE_RUN=true in workflow_dispatch to override.');
    return;
  }

  const currentDay = state.currentDay || 1;
  const totalDays = state.totalDays || 30;

  // Milestone catalog or custom milestone
  const customMilestone = process.env.INPUT_MILESTONE || process.env.MILESTONE;
  let dayMilestone = customMilestone || `Implement modular components and test suites for Day ${currentDay}`;

  const defaultRoadmap = [
    "Project setup, directory scaffolding, and environment config",
    "Data models, schema definitions, and validation helpers",
    "Core business logic services and state controller",
    "API routing, controller endpoints, and request middleware",
    "Authentication layer, session tokens, and security rules",
    "Persistent data store adapters and caching interface",
    "Frontend layout, UI components, and navigation structure",
    "Interactive UI actions, forms, and validation feedback",
    "Data synchronization, error boundaries, and notifications",
    "Automated unit testing suite and edge-case validation",
    "Performance optimizations, asset bundling, and code cleanup",
    "Comprehensive documentation, API specs, and final release"
  ];

  if (!customMilestone && defaultRoadmap[currentDay - 1]) {
    dayMilestone = defaultRoadmap[currentDay - 1];
  }

  console.log(`📅 Progress: Day ${currentDay} of ${totalDays}`);
  console.log(`🎯 Today's Milestone: "${dayMilestone}"`);

  let generatedCommits = null;

  // Attempt Gemini AI Generation if API key is provided
  if (GEMINI_API_KEY) {
    console.log(`🤖 Prompting Google Gemini AI to craft code for Day ${currentDay}...`);
    try {
      const prompt = `You are a Principal Software Engineer.
Generate exactly ${COMMITS_PER_DAY} distinct, high-quality git commits for Day ${currentDay} of ${totalDays} of project "${state.projectName}".
Today's Objective: "${dayMilestone}"

Requirements:
- Each commit must contain 1 or more fully written, valid, production-ready code/test/markdown files.
- Conventional commit message ("feat(...): ...", "test(...): ...").
- Return ONLY a valid JSON array of objects:
[
  {
    "message": "feat(core): implement ${dayMilestone}",
    "files": [
      {
        "path": "src/features/feature_${currentDay}.js",
        "content": "// valid runnable code here"
      }
    ]
  }
]`;

      const aiText = await callGemini({
        apiKey: GEMINI_API_KEY,
        prompt,
        systemInstruction: 'You generate production-quality code. Output strictly a JSON array without markdown code blocks.'
      });

      const parsed = parseLenientJson(aiText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        generatedCommits = parsed;
        console.log(`✅ Gemini successfully generated ${parsed.length} commit(s)!`);
      }
    } catch (aiErr) {
      console.warn(`⚠️ Gemini API notice: ${aiErr.message}`);
      console.log('🔄 Activating autonomous resilient code generator to guarantee the daily streak...');
    }
  } else {
    console.log('ℹ️ No GEMINI_API_KEY secret detected. Utilizing autonomous resilient code generator.');
  }

  // Fallback to resilient code generator if AI did not return commits
  if (!generatedCommits || !Array.isArray(generatedCommits) || generatedCommits.length === 0) {
    generatedCommits = generateResilientDayCode({
      projectName: state.projectName,
      dayNumber: currentDay,
      totalDays: totalDays,
      milestone: dayMilestone,
      commitsCount: COMMITS_PER_DAY
    });
    console.log(`✨ Generated ${generatedCommits.length} resilient code commit(s).`);
  }

  // Configure Git Committer info (crucial for GitHub green squares attribution)
  const committerName = process.env.GIT_AUTHOR_NAME || GITHUB_ACTOR || 'GitStreak Bot';
  const committerEmail = process.env.GIT_AUTHOR_EMAIL || `${GITHUB_ACTOR}@users.noreply.github.com`;

  runCmd(`git config user.name "${committerName}"`, workingDir);
  runCmd(`git config user.email "${committerEmail}"`, workingDir);

  // Push commits sequentially
  for (let i = 0; i < generatedCommits.length; i++) {
    const item = generatedCommits[i];
    const commitMsg = item.message || item.commitMessage || `feat: update project progress for Day ${currentDay}`;

    // Write all files
    for (const file of (item.files || [])) {
      const cleanPath = (file.path || '').replace(/^\.?\/+/, '').trim();
      if (!cleanPath) continue;

      const fullFilePath = path.join(workingDir, cleanPath);
      const fileDir = path.dirname(fullFilePath);
      if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

      fs.writeFileSync(fullFilePath, file.content || '', 'utf-8');
      console.log(`   📝 Wrote: ${cleanPath}`);
    }

    // Update README progress badge & checklist
    const readmePath = path.join(workingDir, 'README.md');
    let readmeContent = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf-8') : `# ${state.projectName}\n\n`;
    const milestoneLine = `- [x] **Day ${currentDay}**: ${dayMilestone}`;

    if (!readmeContent.includes(milestoneLine)) {
      if (readmeContent.includes('<!-- gitstreak-roadmap-end -->')) {
        readmeContent = readmeContent.replace('<!-- gitstreak-roadmap-end -->', `${milestoneLine}\n<!-- gitstreak-roadmap-end -->`);
      } else {
        readmeContent += `\n${milestoneLine}\n`;
      }
      fs.writeFileSync(readmePath, readmeContent, 'utf-8');
    }

    // Git stage, commit, and push
    runCmd('git add .', workingDir);
    runCmd(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, workingDir);
    console.log(`   ✅ Committed: "${commitMsg}"`);

    // Stagger slightly between commits
    if (i < generatedCommits.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Advance state
  state.currentDay = currentDay + 1;
  state.lastRunDate = todayIst;
  state.history.push({
    day: currentDay,
    milestone: dayMilestone,
    date: todayIst,
    commitsCount: generatedCommits.length
  });

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
  runCmd('git add .gitstreak/', workingDir);
  runCmd(`git commit -m "chore(gitstreak): advance progress to Day ${state.currentDay}"`, workingDir);

  // Push to remote branch
  console.log('🚀 Pushing commits to GitHub remote...');
  try {
    runCmd('git push origin HEAD', workingDir);
    console.log('🎉 Successfully pushed commits to GitHub!');
  } catch (pushErr) {
    console.log('Attempting git pull --rebase and push...');
    runCmd('git pull --rebase origin HEAD', workingDir);
    runCmd('git push origin HEAD', workingDir);
    console.log('🎉 Successfully pushed commits after rebase!');
  }

  console.log('========================================================');
  console.log(`🌟 DAY ${currentDay} COMPLETED! GREEN STREAK PRESERVED!`);
  console.log('========================================================');
}

main().catch(err => {
  console.error('❌ Streak runner fatal error:', err);
  process.exit(1);
});
