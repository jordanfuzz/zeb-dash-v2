const { Router } = require('express')
const pool = require('../db/pool')

const router = Router()

// GET /api/users — list all users
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, created_at
       FROM users
       ORDER BY created_at DESC`
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

module.exports = router
