const { Octokit } = require('@octokit/rest');

function getOctokit(token) {
  return new Octokit({ auth: token });
}

/**
 * Validates token and checks repository access
 */
async function validateTokenAndRepo({ token, owner, repo }) {
  const octokit = getOctokit(token);

  // Check authenticated user
  const { data: user } = await octokit.rest.users.getAuthenticated();

  // Check repository
  try {
    const { data: repository } = await octokit.rest.repos.get({
      owner,
      repo
    });

    return {
      success: true,
      user: {
        login: user.login,
        name: user.name || user.login,
        email: user.email || `${user.login}@users.noreply.github.com`,
        avatarUrl: user.avatar_url
      },
      repository: {
        fullName: repository.full_name,
        defaultBranch: repository.default_branch || 'main',
        private: repository.private,
        htmlUrl: repository.html_url
      }
    };
  } catch (err) {
    if (err.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found or the provided token does not have access to it.`);
    }
    throw err;
  }
}

/**
 * Pushes a commit containing multiple files to GitHub.
 * Handles both brand new empty repositories and existing repositories.
 */
async function pushCommitWithFiles({ token, owner, repo, branch = 'main', message, files = [], author }) {
  if (!files || files.length === 0) {
    throw new Error('No files provided for commit');
  }

  const octokit = getOctokit(token);
  const authorEmail = (author?.email && !author.email.includes('.local'))
    ? author.email
    : `${owner}@users.noreply.github.com`;

  const authorInfo = {
    name: author?.name || owner || 'GitStreak Bot',
    email: authorEmail,
    date: new Date().toISOString()
  };

  // Check if branch exists
  let latestCommitSha = null;
  let baseTreeSha = null;
  let isRepoEmpty = false;

  try {
    const refData = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    latestCommitSha = refData.data.object.sha;

    const commitData = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha
    });
    baseTreeSha = commitData.data.tree.sha;
  } catch (err) {
    if (err.status === 404 || err.status === 409) {
      // Empty repository or branch does not exist
      isRepoEmpty = true;
    } else {
      throw err;
    }
  }

  // If repo is completely empty, initialize it with first file using createOrUpdateFileContents
  if (isRepoEmpty) {
    const firstFile = files[0];
    const initialRes = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: firstFile.path,
      message: message,
      content: Buffer.from(firstFile.content, 'utf-8').toString('base64'),
      branch: branch,
      committer: {
        name: authorInfo.name,
        email: authorInfo.email
      },
      author: {
        name: authorInfo.name,
        email: authorInfo.email
      }
    });

    const commitSha = initialRes.data.commit.sha;

    // If there were more than 1 file in the batch, commit the rest using tree API
    if (files.length > 1) {
      const remainingFiles = files.slice(1);
      return await pushCommitWithFiles({
        token,
        owner,
        repo,
        branch,
        message: `${message} (part 2)`,
        files: remainingFiles,
        author
      });
    }

    return {
      commitSha,
      htmlUrl: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
      branch,
      filesPushed: [firstFile.path]
    };
  }

  // Create blobs for all files
  const treeItems = [];
  for (const file of files) {
    const cleanPath = (file.path || '').replace(/^\.?\/+/, '').trim();
    if (!cleanPath) continue;

    const { data: blob } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(file.content, 'utf-8').toString('base64'),
      encoding: 'base64'
    });

    treeItems.push({
      path: cleanPath,
      mode: '100644', // standard file
      type: 'blob',
      sha: blob.sha
    });
  }

  // Create tree
  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems
  });

  // Create commit
  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: latestCommitSha ? [latestCommitSha] : [],
    author: authorInfo,
    committer: authorInfo
  });

  // Update reference to point to new commit
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
    force: true
  });

  return {
    commitSha: newCommit.sha,
    htmlUrl: newCommit.html_url || `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    branch,
    filesPushed: files.map(f => f.path)
  };
}

/**
 * Gets repository existing file tree structure (to help Gemini understand current state)
 */
async function getRepoTreeOverview({ token, owner, repo, branch = 'main' }) {
  try {
    const octokit = getOctokit(token);
    const { data: branchData } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch
    });
    const treeSha = branchData.commit.commit.tree.sha;
    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: '1'
    });

    const fileList = (tree.tree || [])
      .filter(item => item.type === 'blob')
      .map(item => item.path)
      .slice(0, 30); // Top 30 files for context

    return fileList;
  } catch {
    return [];
  }
}

module.exports = {
  validateTokenAndRepo,
  pushCommitWithFiles,
  getRepoTreeOverview
};
