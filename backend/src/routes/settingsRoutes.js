const express = require('express');
const { body } = require('express-validator');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get('/', getSettings);
router.patch(
  '/',
  body('schoolName').optional().isString().trim().isLength({ min: 2, max: 160 }),
  body('workStartTime').optional().matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body('workEndTime').optional().matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body('gracePeriodMinutes').optional().isInt({ min: 0, max: 240 }).toInt(),
  body('timeZone').optional().isString().trim().isLength({ min: 1, max: 100 }),
  validateRequest,
  updateSettings
);

module.exports = router;
