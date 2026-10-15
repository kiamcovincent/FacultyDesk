const settingsService = require('../services/settingsService');

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const getSettings = handleAsync(async (req, res) => {
  const settings = await settingsService.getCurrentSettings();
  res.status(200).json({ settings });
});

const updateSettings = handleAsync(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.user._id, req.ip);
  res.status(200).json({ settings });
});

module.exports = { getSettings, updateSettings };
