const express = require('express');

const router = express.Router();

router.use('/health', require('./healthRoutes'));
router.use('/auth', require('./authRoutes'));
router.use('/attendance', require('./attendanceRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/teachers', require('./teacherRoutes'));
router.use('/departments', require('./departmentRoutes'));
router.use('/subjects', require('./subjectRoutes'));
router.use('/schedules', require('./scheduleRoutes'));
router.use('/students', require('./studentRoutes'));
router.use('/class-attendance', require('./classAttendanceRoutes'));
router.use('/leave-requests', require('./leaveRequestRoutes'));
router.use('/correction-requests', require('./correctionRequestRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/settings', require('./settingsRoutes'));
router.use('/audit-logs', require('./auditLogRoutes'));

module.exports = router;
