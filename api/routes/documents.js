const { Router } = require('express')
const pool = require('../db/pool')

const router = Router()

// POST /api/documents — ingest from future skills
router.post('/', async (req, res, next) => {
  try {
    const {
      document_type,
      title,
      content,
      user_name,
      repo,
      branch,
      conversation_id,
    } = req.body

    // Validate required fields
    const missing = []
    if (!document_type) missing.push('document_type')
    if (!content) missing.push('content')
    if (!user_name) missing.push('user_name')
    if (!repo) missing.push('repo')
    if (!branch) missing.push('branch')
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
        `INSERT INTO repositories (owner, name) VALUES ($1, $2)
         ON CONFLICT (owner, name) DO NOTHING
         RETURNING id`,
        [owner, repoName]
      )
      let repositoryId
      if (repoResult.rows.length > 0) {
        repositoryId = repoResult.rows[0].id
      } else {
        const existing = await client.query(
          `SELECT id FROM repositories WHERE owner = $1 AND name = $2`,
          [owner, repoName]
        )
        repositoryId = existing.rows[0].id
      }

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

      // Verify conversation_id if provided
      if (conversation_id) {
        const convoCheck = await client.query(
          `SELECT id FROM conversations WHERE id = $1`,
          [conversation_id]
        )
        if (convoCheck.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({
            error: `Conversation '${conversation_id}' not found`,
          })
        }
      }

      // Insert document
      const docResult = await client.query(
        `INSERT INTO documents (document_type, title, content, user_id, branch_id, conversation_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          document_type,
          title || null,
          content,
          userId,
          branchId,
          conversation_id || null,
        ]
      )

      await client.query('COMMIT')
      res.status(201).json({
        id: docResult.rows[0].id,
        message: 'Document ingested successfully',
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
})

// GET /api/documents — list documents (without content)
router.get('/', async (req, res, next) => {
  try {
    const { repo_id, branch_id, user_id, document_type } = req.query
    const conditions = []
    const params = []

    if (repo_id) {
      params.push(repo_id)
      conditions.push(`b.repository_id = $${params.length}`)
    }
    if (branch_id) {
      params.push(branch_id)
      conditions.push(`d.branch_id = $${params.length}`)
    }
    if (user_id) {
      params.push(user_id)
      conditions.push(`d.user_id = $${params.length}`)
    }
    if (document_type) {
      params.push(document_type)
      conditions.push(`d.document_type = $${params.length}`)
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await pool.query(
      `SELECT d.id, d.document_type, d.title, d.conversation_id, d.created_at,
              u.name AS user_name, u.id AS user_id,
              r.owner || '/' || r.name AS repo, r.id AS repo_id,
              b.name AS branch, b.id AS branch_id
       FROM documents d
       JOIN users u ON d.user_id = u.id
       JOIN branches b ON d.branch_id = b.id
       JOIN repositories r ON b.repository_id = r.id
       ${where}
       ORDER BY d.created_at DESC`,
      params
    )

    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/documents/:id — single document with content
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT d.*, u.name AS user_name,
              r.owner || '/' || r.name AS repo, r.id AS repo_id,
              b.name AS branch, b.id AS branch_id
       FROM documents d
       JOIN users u ON d.user_id = u.id
       JOIN branches b ON d.branch_id = b.id
       JOIN repositories r ON b.repository_id = r.id
       WHERE d.id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

module.exports = router
