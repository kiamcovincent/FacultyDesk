const express = require('express');
const { body, param, query } = require('express-validator');
const { createDepartment, listDepartments, updateDepartmentStatus } = require('../controllers/academicController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('active').optional().isBoolean().toBoolean(),
  validateRequest,
  listDepartments
);

router.post(
  '/',
  authorize('admin'),
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('code').isString().trim().isLength({ min: 2, max: 20 }).matches(/^[a-zA-Z0-9-]+$/),
  validateRequest,
  createDepartment
);

router.patch(
  '/:departmentId/status',
  authorize('admin'),
  param('departmentId').isMongoId(),
  body('active').isBoolean().toBoolean(),
  validateRequest,
  updateDepartmentStatus
);

module.exports = router;
