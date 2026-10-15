const express = require('express');
const { param, query } = require('express-validator');
const { listNotifications, markNotificationRead } = require('../controllers/requestController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('unread').optional().isBoolean().toBoolean(),
  validateRequest,
  listNotifications
);

router.patch(
  '/:notificationId/read',
  param('notificationId').isMongoId(),
  validateRequest,
  markNotificationRead
);

module.exports = router;
