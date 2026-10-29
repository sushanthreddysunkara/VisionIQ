const express = require('express')
const router = express.Router()
const { checkOllamaStatus, parseNaturalLanguageQuery, naturalToCypher } = require('../controllers/queryController')

// GET /api/query/ollama-status
router.get('/ollama-status', checkOllamaStatus)

// POST /api/query/ai-parse
router.post('/ai-parse', parseNaturalLanguageQuery)

// POST /api/query/natural-to-cypher
router.post('/natural-to-cypher', naturalToCypher)

module.exports = router
