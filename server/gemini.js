/**
 * Gemini AI Client for GitStreak
 * Interacts with Google Gemini models with automatic multi-model fallback & suggestion detection
 */

const PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro'
];

/**
 * Discovers available models for the given API key using ModelService.ListModels
 */
async function getCandidateModels(apiKey) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please provide a valid key.');
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 400 || res.status === 403 || errorText.includes('API_KEY_INVALID')) {
        throw new Error('The provided Google Gemini API Key is invalid. Please check your key at Google AI Studio.');
      }
      return [...PREFERRED_MODELS];
    }

    const data = await res.json();
    const available = (data.models || [])
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''));

    const ordered = [];
    // Prioritize preferred models in order
    for (const pref of PREFERRED_MODELS) {
      if (available.includes(pref)) {
        ordered.push(pref);
      }
    }

    // Append any other available models
    for (const av of available) {
      if (!ordered.includes(av)) {
        ordered.push(av);
      }
    }

    return ordered.length > 0 ? ordered : [...PREFERRED_MODELS];
  } catch (err) {
    if (err.message.includes('API_KEY_INVALID') || err.message.includes('invalid')) {
      throw err;
    }
    return [...PREFERRED_MODELS];
  }
}

/**
 * Calls Gemini API with automatic fallback across candidate models
 */
async function callGeminiApi({ apiKey, prompt, systemInstruction = '', responseSchema = null }) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please provide a valid key.');
  }

  const candidateModels = await getCandidateModels(apiKey);
  let lastError = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const modelName = candidateModels[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const body = {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 8192
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

      // If rejected with 400 Bad Request by an older model (e.g. responseMimeType or systemInstruction), retry without unsupported flags
      if (!res.ok && res.status === 400) {
        const errorPeek = await res.clone().text();
        let shouldRetry = false;
        if (body.generationConfig?.responseMimeType && (errorPeek.includes('responseMimeType') || errorPeek.includes('generationConfig'))) {
          delete body.generationConfig.responseMimeType;
          shouldRetry = true;
        }
        if (body.systemInstruction && (errorPeek.includes('system_instruction') || errorPeek.includes('systemInstruction'))) {
          delete body.systemInstruction;
          shouldRetry = true;
        }
        if (shouldRetry) {
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
        }
      }

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 400 && errorText.includes('API_KEY_INVALID')) {
          throw new Error('The provided Google Gemini API Key is invalid. Please check your key at Google AI Studio.');
        }

        // If Google suggests a specific model (e.g. "update your code to use models/gemini-3.8-flash")
        const suggested = errorText.match(/models\/([a-zA-Z0-9.-]+)/);
        if (suggested && suggested[1] && !candidateModels.includes(suggested[1])) {
          console.log(`[Gemini] Google suggested model "${suggested[1]}". Inserting as next candidate...`);
          candidateModels.splice(i + 1, 0, suggested[1]);
        }

        // If 404, deprecated, or no longer available, continue to next model
        if (res.status === 404 || errorText.includes('no longer available') || errorText.includes('not supported') || errorText.includes('NOT_FOUND')) {
          console.warn(`[Gemini] Model "${modelName}" returned 404/unavailable. Trying next model...`);
          lastError = new Error(`Model ${modelName} unavailable: ${errorText}`);
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
      if (err.message.includes('API_KEY_INVALID')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All candidate Gemini models failed.');
}

/**
 * Validates Gemini API key with a ping
 */
async function validateGeminiApiKey(apiKey) {
  try {
    const text = await callGeminiApi({
      apiKey,
      prompt: 'Respond with "VALID" only.'
    });
    const candidates = await getCandidateModels(apiKey);
    return {
      success: true,
      model: candidates[0] || 'gemini-3.8-flash',
      message: `Google Gemini API Key is valid and active.`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Lenient JSON parser that handles trailing commas and unescaped newlines/tabs inside string literals
 */
function tryParseLenient(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {}

  // Strip trailing commas before closing braces/brackets
  const sanitized = str.replace(/,\s*([\]}])/g, '$1');
  try {
    return JSON.parse(sanitized);
  } catch {}

  // Repair unescaped newlines and tabs inside string literals
  try {
    let inString = false;
    let escaped = false;
    let fixed = '';
    for (let i = 0; i < sanitized.length; i++) {
      const char = sanitized[i];
      if (char === '"' && !escaped) {
        inString = !inString;
      }
      if (inString && (char === '\n' || char === '\r')) {
        fixed += char === '\n' ? '\\n' : '';
      } else if (inString && char === '\t') {
        fixed += '\\t';
      } else {
        fixed += char;
      }
      escaped = char === '\\' && !escaped;
    }
    return JSON.parse(fixed);
  } catch {}

  return null;
}

/**
 * Robust JSON extraction from LLM responses that may contain conversational text,
 * markdown bullet points, code fences, or trailing commas.
 */
function extractAndParseJson(text, preferredArrayKey = null) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response from AI');
  }

  const trimmed = text.trim();

  function evaluateCandidate(parsed) {
    if (!parsed) return null;
    if (Array.isArray(parsed)) return parsed;
    if (preferredArrayKey && Array.isArray(parsed[preferredArrayKey])) return parsed[preferredArrayKey];
    if (Array.isArray(parsed.commits)) return parsed.commits;
    if (Array.isArray(parsed.plan)) return parsed.plan;
    if (Array.isArray(parsed.data)) return parsed.data;
    if (typeof parsed === 'object') return parsed;
    return null;
  }

  // Attempt 1: Direct lenient parse
  const direct = evaluateCandidate(tryParseLenient(trimmed));
  if (direct) return direct;

  // Attempt 2: Extract from ```json ... ``` or ``` ... ``` code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  while ((match = codeBlockRegex.exec(trimmed)) !== null) {
    const candidate = match[1].trim();
    const parsed = evaluateCandidate(tryParseLenient(candidate));
    if (parsed) return parsed;
  }

  // Attempt 3: Find outermost bracket pair '[' ... ']'
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidate = trimmed.substring(firstBracket, lastBracket + 1);
    const parsed = evaluateCandidate(tryParseLenient(candidate));
    if (parsed) return parsed;
  }

  // Attempt 4: Find outermost curly braces '{' ... '}' in case wrapped in object
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.substring(firstBrace, lastBrace + 1);
    const parsed = evaluateCandidate(tryParseLenient(candidate));
    if (parsed) return parsed;
  }

  throw new Error(`Could not parse JSON from AI response: ${trimmed.substring(0, 100)}...`);
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
    systemInstruction: 'You are an expert code architect. Always output strictly valid JSON starting with [ and ending with ] with no markdown bullets or preamble.',
    responseSchema: true
  });

  try {
    const plan = extractAndParseJson(text, 'plan');
    if (!Array.isArray(plan)) {
      throw new Error('Plan is not an array');
    }
    return plan;
  } catch (parseErr) {
    console.error('Failed to parse plan JSON:', text);
    throw new Error(`Gemini did not return valid JSON for the project plan: ${parseErr.message}`);
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
  const prompt = `CRITICAL INSTRUCTION: You must respond ONLY with a raw JSON array. DO NOT include any preamble, bullet points, introduction, explanation, markdown formatting, or markdown code blocks (e.g., no \`\`\`json). The first character of your response MUST be "[" and the last character MUST be "]".

You are a Senior Full-Stack Engineer working on the repository for project: "${projectName}".
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
        "content": "{\\n  \\"name\\": \\"my-app\\"\\n}"
      },
      {
        "path": "README.md",
        "content": "# ${projectName}\\n\\n${description}"
      }
    ]
  }
]`;

  const text = await callGeminiApi({
    apiKey,
    prompt,
    systemInstruction: 'You are an elite software developer. You generate complete, runnable, production-quality source code. Output strictly a valid JSON array starting with [ and ending with ] without any markdown bullets, headers, or wrapping.',
    responseSchema: true
  });

  try {
    const commits = extractAndParseJson(text, 'commits');

    if (!Array.isArray(commits) || commits.length === 0) {
      throw new Error('AI returned an empty commits array');
    }

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
