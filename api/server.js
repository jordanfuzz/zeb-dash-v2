const express = require('express')
const path = require('path')
const { default: migrate } = require('node-pg-migrate')
const pool = require('./db/pool')
const errorHandler = require('./middleware/errors')

const conversationRoutes = require('./routes/conversations')
const documentRoutes = require('./routes/documents')
const repositoryRoutes = require('./routes/repositories')
const branchRoutes = require('./routes/branches')
const userRoutes = require('./routes/users')

const app = express()
const PORT = process.env.PORT || 3000
const BODY_LIMIT = process.env.BODY_LIMIT || '10mb'

app.use(express.json({ limit: BODY_LIMIT }))

app.use('/api/conversations', conversationRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/repositories', repositoryRoutes)
app.use('/api/branches', branchRoutes)
app.use('/api/users', userRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use(errorHandler)

async function runMigrations() {
  const client = await pool.connect()
  try {
    await migrate({
      dbClient: client,
      migrationsTable: 'pgmigrations',
      dir: path.join(__dirname, 'db', 'migrations'),
      direction: 'up',
      log: console.log,
    })
  } finally {
    client.release()
  }
}

async function start() {
  console.log('Running migrations...')
  await runMigrations()
  console.log('Migrations complete.')

  app.listen(PORT, () => {
    console.log(`Zeb Dash API listening on port ${PORT}`)
  })
}

start().catch(err => {
  console.error('Failed to start:', err)
  process.exit(1)
})
