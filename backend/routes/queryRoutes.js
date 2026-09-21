const express = require('express')
const router = express.Router()
const { checkOllamaStatus, parseNaturalLanguageQuery } = require('../controllers/queryController')

// GET /api/query/ollama-status
router.get('/ollama-status', checkOllamaStatus)

// POST /api/query/ai-parse
router.post('/ai-parse', parseNaturalLanguageQuery)

module.exports = router
