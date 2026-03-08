const AuditLog = require('../models/AuditLog');

const logAction = async (userId, action, type, details = {}) => {
    try {
        await AuditLog.create({
            user: userId,
            action,
            type,
            details
        });
    } catch (error) {
        console.error('Audit Log Error:', error);
    }
};

module.exports = { logAction };
