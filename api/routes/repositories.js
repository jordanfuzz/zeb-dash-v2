const { Router } = require('express')
const pool = require('../db/pool')

const router = Router()

// GET /api/repositories — list all repositories
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, owner, name, owner || '/' || name AS full_name, remote_url, created_at
       FROM repositories
       ORDER BY created_at DESC`
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/repositories/:id — single repository
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, owner, name, owner || '/' || name AS full_name, remote_url, created_at
       FROM repositories
       WHERE id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repository not found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    next(err)
  }
})

module.exports = router
