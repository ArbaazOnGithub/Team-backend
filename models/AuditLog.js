const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    type: { type: String, enum: ['auth', 'chat', 'request', 'admin', 'system'], required: true },
    createdAt: { type: Date, default: Date.now }
});

// TTL Index: Delete logs older than 15 days (15 * 24 * 60 * 60 seconds)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
