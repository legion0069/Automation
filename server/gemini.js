/**
 * Gemini AI Client for GitStreak
 * Interacts with Google Gemini models to generate technical plans and functional code commits.
 */

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

/**
 * Helper to call Gemini GenerateContent REST API
 */
async function callGeminiApi({ apiKey, prompt, systemInstruction = '', responseSchema = null }) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please provide a valid key.');
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const body = {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95
        }
      };

      if (systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      if (responseSchema) {
        body.generationConfig.responseMimeType = 'application/json';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorText = await res.text();
        // If 404 model not found, try next model
        if (res.status === 404 || res.status === 400 && errorText.includes('not supported')) {
          lastError = new Error(`Model ${model} failed: ${errorText}`);
          continue;
        }
        throw new Error(`Gemini API error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      return text;
    } catch (err) {
      lastError = err;
      if (err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid')) {
        throw new Error('The provided Google Gemini API Key is invalid. Please check your key at Google AI Studio.');
      }
    }
  }

  throw lastError || new Error('All Gemini models failed to generate response');
}

/**
 * Validates Gemini API key with a fast ping test
 */
async function validateGeminiApiKey(apiKey) {
  try {
    const text = await callGeminiApi({
      apiKey,
      prompt: 'Respond with the word "VALID" only.'
    });
    return { success: true, message: 'Gemini API Key is valid and active.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Auto-generates a structured day-by-day technical project plan
 */
async function generateProjectPlan({ apiKey, projectName, description, totalDays = 14 }) {
  const prompt = `You are a Principal Software Architect.
Create an exact ${totalDays}-day realistic software development roadmap for the project:
Project Name: "${projectName}"
Description: "${description}"

Requirements:
- Plan exactly ${totalDays} days (from Day 1 to Day ${totalDays}).
- Progression must be realistic and functional:
  - Day 1: Project scaffolding, configurations (.gitignore, package.json / requirements.txt, environment setup).
  - Early days: Core models, database schemas, utility helpers.
  - Mid days: Business logic, API endpoints / routes, controllers.
  - Later days: Frontend UI components, state management, styling.
  - Final days: Integration, error handling, documentation (README with badges, API docs), and test suites.
- Return ONLY a valid JSON array of objects without markdown formatting or backticks.
- JSON structure:
[
  {
    "day": 1,
    "title": "Project Setup & Scaffolding",
    "description": "Initialize package configuration, repository structure, and linting rules."
  },
  ...
]`;

  const text = await callGeminiApi({
    apiKey,
    prompt,
    systemInstruction: 'You are an expert code architect. Always output strictly valid JSON with no markdown wrapping.',
    responseSchema: true
  });

  try {
    // Strip possible markdown fences if returned
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const plan = JSON.parse(cleaned);
    if (!Array.isArray(plan)) {
      throw new Error('Plan is not an array');
    }
    return plan;
  } catch (parseErr) {
    console.error('Failed to parse plan JSON:', text);
    throw new Error('Gemini did not return valid JSON for the project plan. Please try again.');
  }
}

/**
 * Generates realistic code files and partitions them into N semantic commits for the day's milestone.
 */
async function generateDailyCode({
  apiKey,
  projectName,
  description,
  currentDay,
  totalDays,
  dayMilestone,
  commitsCount = 2,
  existingFiles = []
}) {
  const prompt = `You are a Senior Full-Stack Engineer working on the repository for project: "${projectName}".
Project Overview: "${description}"
Progress: Day ${currentDay} of ${totalDays}.
Today's Objective / Milestone: "${dayMilestone}"
Existing files already in repository:
${existingFiles.length > 0 ? existingFiles.map(f => '- ' + f).join('\n') : '(None yet - brand new repository)'}

Task:
You need to produce exactly ${commitsCount} separate, incremental, high-quality git commits for today's progress.
Each commit must:
1. Contain 1 or more realistic, fully written code/config/markdown files (NO dummy placeholders, NO "// TODO implement later", write real working code!).
2. Have a clear, conventional commit message (e.g., "feat(core): create user schema and validation rules", "test(auth): add unit tests for token generation", "docs: update API documentation for v1 routes").
3. File contents must be valid source code (e.g. JavaScript, TypeScript, Python, HTML/CSS, JSON, or Markdown as appropriate for the project).
4. File paths must be relative (e.g., "src/index.js", "README.md", "controllers/authController.js").

Return ONLY a valid JSON array of commit objects:
[
  {
    "commitMessage": "feat(scaffold): initialize core project configuration and dependencies",
    "files": [
      {
        "path": "package.json",
        "content": "{\\n  \\"name\\": \\"...\\"...\\n}"
      },
      {
        "path": "README.md",
        "content": "# ${projectName}\\n\\n${description}..."
      }
    ]
  }
]`;

  const text = await callGeminiApi({
    apiKey,
    prompt,
    systemInstruction: 'You are an elite software developer. You generate complete, runnable, production-quality source code. Output strictly valid JSON without markdown wrapping.',
    responseSchema: true
  });

  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const commits = JSON.parse(cleaned);

    if (!Array.isArray(commits) || commits.length === 0) {
      throw new Error('AI returned an empty commits array');
    }

    // Validate structure
    for (const c of commits) {
      if (!c.commitMessage || !Array.isArray(c.files) || c.files.length === 0) {
        throw new Error('Invalid commit structure in AI output');
      }
      for (const f of c.files) {
        if (!f.path || typeof f.content !== 'string') {
          throw new Error(`Invalid file entry in commit "${c.commitMessage}"`);
        }
      }
    }

    return commits;
  } catch (err) {
    console.error('Failed to parse daily code JSON from Gemini:', text);
    throw new Error(`Failed to generate daily code: ${err.message}`);
  }
}

module.exports = {
  validateGeminiApiKey,
  generateProjectPlan,
  generateDailyCode
};
