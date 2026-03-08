const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    type: { type: String, enum: ['auth', 'chat', 'request', 'admin', 'system'], required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
