const express = require('express')
const aiController = require('../controllers/ai.controller')
const { requireAuth } = require('../middlewares/auth.middleware')

const router = express.Router()

router.post('/get-review', requireAuth, aiController.getReview)               // JSON, non-streaming
router.post('/get-review/stream', requireAuth, aiController.getReviewStream)  // text/plain, streamed
router.post('/get-repo-review', requireAuth, aiController.getRepoReview)      // GitHub repo/PR, streamed

module.exports = router
