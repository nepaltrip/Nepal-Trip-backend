const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// Ensure VAPID details are set here too
webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const sendWebPush = async (userId, title, message, url = '/') => {
    try {
        // 1. Find all browser subscriptions for this specific user/admin
        const subscriptions = await PushSubscription.find({ userId: userId });

        if (subscriptions.length === 0) return; // They haven't allowed notifications

        // 2. The payload that sw.js will receive
        const payload = JSON.stringify({ title, message, url });

        // 3. Shoot the push to all their active devices
        const pushPromises = subscriptions.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                payload
            ).catch(err => {
                // If user revoked permission in their browser settings, delete the dead subscription
                if (err.statusCode === 404 || err.statusCode === 410) {
                    return PushSubscription.deleteOne({ _id: sub._id });
                }
                console.error("Push Error:", err);
            })
        );

        await Promise.all(pushPromises);
    } catch (error) {
        console.error("Error sending web push:", error);
    }
};

module.exports = { sendWebPush };