const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, authorize('teacher'), getDashboard);
router.get('/admin', authenticate, authorize('admin'), getDashboard);

module.exports = router;
