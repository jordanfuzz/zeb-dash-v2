const { Router } = require('express')
const pool = require('../db/pool')

const router = Router()

// POST /api/conversations — ingest from /post-session
router.post('/', async (req, res, next) => {
  try {
    const {
      session_id,
      user_name,
      repo,
      branch,
      git_commit,
      git_remote,
      claude_model,
      claude_version,
      transcript,
    } = req.body

    // Validate required fields
    const missing = []
    if (!session_id) missing.push('session_id')
    if (!user_name) missing.push('user_name')
    if (!repo) missing.push('repo')
    if (!branch) missing.push('branch')
    if (!transcript) missing.push('transcript')
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      })
    }

    // Parse owner/repo
    const repoParts = repo.split('/')
    if (repoParts.length !== 2) {
      return res.status(400).json({
        error: `Invalid repo format: expected "owner/repo", got "${repo}"`,
      })
    }
    const [owner, repoName] = repoParts

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Upsert user
      const userResult = await client.query(
        `INSERT INTO users (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [user_name]
      )
      const userId = userResult.rows[0].id

      // Upsert repository
      const repoResult = await client.query(
        `INSERT INTO repositories (owner, name, remote_url) VALUES ($1, $2, $3)
         ON CONFLICT (owner, name) DO UPDATE SET remote_url = COALESCE(EXCLUDED.remote_url, repositories.remote_url)
         RETURNING id`,
        [owner, repoName, git_remote || null]
      )
      const repositoryId = repoResult.rows[0].id

      // Upsert branch
      let branchResult = await client.query(
        `INSERT INTO branches (repository_id, name) VALUES ($1, $2)
         ON CONFLICT (repository_id, name) DO NOTHING
         RETURNING id`,
        [repositoryId, branch]
      )
      if (branchResult.rows.length === 0) {
        branchResult = await client.query(
          `SELECT id FROM branches WHERE repository_id = $1 AND name = $2`,
          [repositoryId, branch]
        )
      }
      const branchId = branchResult.rows[0].id

      // Insert conversation
      await client.query(
        `INSERT INTO conversations (id, user_id, branch_id, git_commit, claude_model, claude_version, transcript)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          session_id,
          userId,
          branchId,
          git_commit || null,
          claude_model || null,
          claude_version || null,
          transcript,
        ]
      )

      await client.query('COMMIT')
      res.status(201).json({
        id: session_id,
        message: 'Conversation ingested successfully',
      })
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505' && err.constraint === 'conversations_pkey') {
        return res.status(409).json({
          error: `Conversation with session_id '${session_id}' already exists`,
        })
      }
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
})

// GET /api/conversations — list conversations (without transcript)
router.get('/', async (req, res, next) => {
  try {
    const { repo_id, branch_id, user_id } = req.query
    const conditions = []
    const params = []

    if (repo_id) {
      params.push(repo_id)
      conditions.push(`b.repository_id = $${params.length}`)
    }
    if (branch_id) {
      params.push(branch_id)
      conditions.push(`c.branch_id = $${params.length}`)
    }
    if (user_id) {
      params.push(user_id)
      conditions.push(`c.user_id = $${params.length}`)
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await pool.query(
      `SELECT c.id, c.git_commit, c.claude_model, c.claude_version, c.created_at,
              u.name AS user_name, u.id AS user_id,
              r.owner || '/' || r.name AS repo, r.id AS repo_id,
              b.name AS branch, b.id AS branch_id
       FROM conversations c
       JOIN users u ON c.user_id = u.id
       JOIN branches b ON c.branch_id = b.id
       JOIN repositories r ON b.repository_id = r.id
       ${where}
       ORDER BY c.created_at DESC`,
      params
    )

    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/conversations/:id — single conversation with transcript
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name AS user_name,
              r.owner || '/' || r.name AS repo, r.id AS repo_id,
              b.name AS branch, b.id AS branch_id
       FROM conversations c
       JOIN users u ON c.user_id = u.id
       JOIN branches b ON c.branch_id = b.id
       JOIN repositories r ON b.repository_id = r.id
       WHERE c.id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

module.exports = router
