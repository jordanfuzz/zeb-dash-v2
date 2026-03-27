const { Router } = require('express')
const pool = require('../db/pool')

const router = Router()

// GET /api/branches — list branches (filterable by repository_id)
router.get('/', async (req, res, next) => {
  try {
    const { repository_id } = req.query
    const conditions = []
    const params = []

    if (repository_id) {
      params.push(repository_id)
      conditions.push(`b.repository_id = $${params.length}`)
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await pool.query(
      `SELECT b.id, b.name, b.repository_id, b.created_at, r.owner || '/' || r.name AS repo
       FROM branches b
       JOIN repositories r ON b.repository_id = r.id
       ${where}
       ORDER BY b.created_at DESC`,
      params
    )

    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

module.exports = router
