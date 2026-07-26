const express = require('express')
const aiController = require('../controllers/ai.controller')

const router = express.Router()

router.post('/get-review', aiController.getReview)               // JSON, non-streaming
router.post('/get-review/stream', aiController.getReviewStream)  // text/plain, streamed
router.post('/get-repo-review', aiController.getRepoReview)      // GitHub repo/PR, streamed

module.exports = router
