const admin = require('firebase-admin');
const path = require('path');
const User = require('../models/User');

// Path to your Firebase service account JSON
const serviceAccountPath = path.join(__dirname, '../config/teamwebapp-27cf4-firebase-adminsdk-fbsvc-28d0190bcd.json');

try {
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
    });
    console.log('✓ Firebase Admin initialized');
} catch (error) {
    console.error('✗ Firebase Admin failed to initialize (check if service account file exists):', error.message);
}

exports.sendPushNotification = async (userId, title, body, data = {}) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.fcmToken) {
            console.log(`No FCM token for user ${userId}, skipping push.`);
            return;
        }

        const message = {
            notification: { title, body },
            data: data,
            token: user.fcmToken
        };

        const response = await admin.messaging().send(message);
        console.log(`✓ Push sent to user ${userId}:`, response);
    } catch (error) {
        console.error(`✗ Push failed for user ${userId}:`, error.message);
    }
};

exports.notifyAdmins = async (companyId, title, body, data = {}) => {
    try {
        const admins = await User.find({ company: companyId, role: { $in: ['admin', 'superadmin'] } });
        const tokens = admins.map(a => a.fcmToken).filter(t => t);
        if (tokens.length === 0) return;
        await this.notifyMultiple(tokens, title, body, data);
    } catch (error) {
        console.error('✗ Admin push failed:', error.message);
    }
};

exports.notifyMultiple = async (tokens, title, body, data = {}) => {
    try {
        if (!tokens || tokens.length === 0) return;
        const message = {
            notification: { title, body },
            data: data,
            tokens: tokens
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`✓ Multicast push sent to ${response.successCount} devices`);
    } catch (error) {
        console.error('✗ Multiple devices push failed:', error.message);
    }
};
