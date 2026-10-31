const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gitstreak-super-secure-secret-2026';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

/**
 * Returns GitHub OAuth Authorization URL
 */
function getGithubAuthUrl(redirectUri, state = 'gitstreak_state') {
  if (!GITHUB_CLIENT_ID) {
    throw new Error('GITHUB_CLIENT_ID is not configured in environment variables.');
  }
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'repo user:email',
    state: state
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges GitHub authorization code for OAuth access token
 */
async function exchangeCodeForToken(code, redirectUri) {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new Error('GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing.');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

/**
 * Fetches authenticated user profile and primary email from GitHub
 */
async function getGithubUserProfile(accessToken) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'User-Agent': 'GitStreak-AI-App'
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) {
    throw new Error(`Failed to fetch GitHub profile: ${userRes.statusText}`);
  }
  const user = await userRes.json();

  let email = user.email;
  if (!email) {
    try {
      const emailRes = await fetch('https://api.github.com/user/emails', { headers });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        const primary = emails.find(e => e.primary && e.verified) || emails[0];
        if (primary) email = primary.email;
      }
    } catch {
      // ignore email secondary failure
    }
  }

  return {
    githubId: String(user.id),
    username: user.login,
    displayName: user.name || user.login,
    avatarUrl: user.avatar_url,
    email: email || `${user.login}@users.noreply.github.com`
  };
}

/**
 * Fetches the user's available repositories
 */
async function getGithubUserRepos(accessToken) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'User-Agent': 'GitStreak-AI-App'
  };

  const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator', { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch repositories (${res.status})`);
  }

  const data = await res.json();
  return (data || []).map(r => ({
    fullName: r.full_name,
    name: r.name,
    owner: r.owner?.login,
    defaultBranch: r.default_branch || 'main',
    private: r.private,
    htmlUrl: r.html_url
  }));
}

/**
 * Signs a JWT session token
 */
function signUserToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      githubId: user.githubId,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: '365d' }
  );
}

/**
 * Express middleware to identify authenticated user (if token present)
 */
function optionalAuth(db) {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.gitstreak_jwt ||
                    req.headers.authorization?.replace(/^Bearer\s+/, '');

      if (!token) {
        req.user = null;
        return next();
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await db.getUserById(decoded.userId);
      req.user = user || null;
      next();
    } catch {
      req.user = null;
      next();
    }
  };
}

module.exports = {
  isOAuthConfigured() {
    return Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
  },
  getGithubAuthUrl,
  exchangeCodeForToken,
  getGithubUserProfile,
  getGithubUserRepos,
  signUserToken,
  optionalAuth
};
