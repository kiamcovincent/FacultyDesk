const express = require('express');
const { body, query } = require('express-validator');
const { addStudent, listStudents } = require('../controllers/classroomController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate, authorize('teacher'));

router.get(
  '/',
  query('subjectId').isMongoId(),
  validateRequest,
  listStudents
);

router.post(
  '/',
  body('subjectId').isMongoId(),
  body('studentNumber').isString().trim().isLength({ min: 1, max: 40 }).matches(/^[a-zA-Z0-9_-]+$/),
  body('firstName').isString().trim().isLength({ min: 1, max: 80 }),
  body('lastName').isString().trim().isLength({ min: 1, max: 80 }),
  validateRequest,
  addStudent
);

module.exports = router;