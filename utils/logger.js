const AuditLog = require('../models/AuditLog');

const logAction = async (userId, action, type, details = {}, company = null) => {
    try {
        await AuditLog.create({
            user: userId,
            company,
            action,
            type,
            details
        });
    } catch (error) {
        console.error('Audit Log Error:', error);
    }
};

module.exports = { logAction };
