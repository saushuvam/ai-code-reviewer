const express = require('express')
const authController = require('../controllers/auth.controller')
const { requireAuth } = require('../middlewares/auth.middleware')

const router = express.Router()

router.post('/signup', authController.signup)
router.post('/signin', authController.signin)
router.post('/logout', authController.logout)
router.get('/me', requireAuth, authController.me)

module.exports = router

