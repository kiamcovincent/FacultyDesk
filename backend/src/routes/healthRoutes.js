const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  if (!databaseConnected) {
    return res.status(503).json({
      status: 'unavailable',
      service: 'FacultyDesk API',
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database connection is unavailable.',
      },
    });
  }

  return res.status(200).json({
    status: 'ok',
    service: 'FacultyDesk API',
    database: 'connected',
  });
});

module.exports = router;
