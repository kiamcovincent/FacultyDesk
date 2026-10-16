const express = require('express');
const mongoose = require('mongoose');
const supabase = require('../config/supabase');

function createHealthRouter({ mongoConnection = mongoose.connection, supabaseClient = supabase } = {}) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const mongoConnected = mongoConnection.readyState === 1;
    let supabaseConnected = false;

    try {
      const { error } = await supabaseClient.from('teachers').select('id').limit(0);
      supabaseConnected = !error;
    } catch {
      supabaseConnected = false;
    }

    const databases = {
      mongodb: mongoConnected ? 'connected' : 'unavailable',
      supabase: supabaseConnected ? 'connected' : 'unavailable',
    };

    if (!mongoConnected || !supabaseConnected) {
      return res.status(503).json({
        status: 'unavailable',
        service: 'FacultyDesk API',
        databases,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'A database connection is unavailable.',
        },
      });
    }

    return res.status(200).json({
      status: 'ok',
      service: 'FacultyDesk API',
      database: 'connected',
      databases,
    });
  });

  return router;
}

const router = createHealthRouter();
router.createHealthRouter = createHealthRouter;

module.exports = router;
