const cron = require('node-cron');

const keepServerAwake = () => {
    // '*/14 * * * *' means run every 14 minutes
    cron.schedule('*/14 * * * *', async () => {
        try {
            // It's best practice to use an environment variable for your live URL
            // Fallback to localhost for testing if needed
            const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';

            const response = await fetch(serverUrl);
            console.log(`[Self-Ping] Server triggered at ${new Date().toLocaleTimeString()}. Status: ${response.status}`);
        } catch (error) {
            console.error('[Self-Ping] Failed to ping server:', error.message);
        }
    });

    console.log('[Cron] Keep-awake job initialized (runs every 14 minutes).');
};

module.exports = { keepServerAwake };