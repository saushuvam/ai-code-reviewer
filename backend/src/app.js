const express = require('express');
const aiRoutes = require('./routes/ai.routes')
const authRoutes = require('./routes/auth.routes')
const cors = require('cors')

const app = express()

app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

app.use(express.json({ limit: '2mb' }))

app.get('/', (req, res) => {
    res.send('Hello World')
})

app.use('/api/auth', authRoutes)
app.use('/ai', aiRoutes)

module.exports = app
