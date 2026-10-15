const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { connectDB } = require('./config/db');
const { ensureScheduleIndexes } = require('./config/indexes');
const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    await ensureScheduleIndexes();
    console.log('Database indexes are ready');
  } catch (error) {
    console.error(error.message);
  }

  return app.listen(port, () => {
    console.log(`FacultyDesk API listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
