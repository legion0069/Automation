/**
 * Gemini AI Client for GitStreak
 * Interacts with Google Gemini models using ModelService.ListModels discovery
 * to automatically detect supported models and generate technical plans & code commits.
 */

// Cache detected working models per API key: { apiKeyPrefix: modelName }
const modelCache = new Map();

/**
 * Discovers available models for the given API key using ModelService.ListModels
 */
async function discoverModel(apiKey) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please provide a valid key.');
  }

  const keyPrefix = apiKey.slice(-8);
  if (modelCache.has(keyPrefix)) {
    return modelCache.get(keyPrefix);
  }

  // Call ModelService.ListModels
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 400 || res.status === 403 || errorText.includes('API_KEY_INVALID')) {
      throw new Error('The provided Google Gemini API Key is invalid. Please check your key at Google AI Studio.');
    }
    throw new Error(`Google API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const models = data.models || [];

  // Filter models that support generateContent
  const usableModels = models.filter(m => 
    Array.isArray(m.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes('generateContent')
  );

  if (usableModels.length === 0) {
    throw new Error('No Gemini models with generateContent capability were found for this API key.');
  }

  // Preference hierarchy: fast & reliable flash models first
  const preferences = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
    'gemini-2.5-pro',
    'gemini-1.5-pro',
    'gemini-pro'
  ];

  let selectedModel = null;
  for (const pref of preferences) {
    const found = usableModels.find(m => 
      m.name === `models/${pref}` || 
      m.name === pref ||
      m.name.endsWith(`/${pref}`)
    );
    if (found) {
      selectedModel = found.name;
      break;
    }
  }

  // Fallback to first available model if none of preferred matched
  if (!selectedModel) {
    selectedModel = usableModels[0].name;
  }

  // Strip leading 'models/' if present to normalize
  const normalized = selectedModel.replace(/^models\//, '');
  modelCache.set(keyPrefix, normalized);
  console.log(`[Gemini] Discovered and selected active model: "${normalized}"`);
  return normalized;
}

/**
 * Helper to call Gemini GenerateContent REST API
 */
async function callGeminiApi({ apiKey, prompt, systemInstruction = '', responseSchema = null }) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please provide a valid key.');
  }

  const modelName = await discoverModel(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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

  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  // If responseSchema / responseMimeType is rejected by an older model, retry without it
  if (!res.ok && responseSchema) {
    delete body.generationConfig.responseMimeType;
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 400 && errorText.includes('API_KEY_INVALID')) {
      throw new Error('The provided Google Gemini API Key is invalid. Please check your key at Google AI Studio.');
    }
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini API');
  }

  return text;
}

/**
 * Validates Gemini API key by discovering available models and performing a lightweight ping
 */
async function validateGeminiApiKey(apiKey) {
  try {
    const model = await discoverModel(apiKey);
    return {
      success: true,
      model,
      message: `Google Gemini API Key is valid and active (using ${model}).`
    };
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
