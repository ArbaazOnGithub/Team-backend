const mongoose = require('mongoose');

const SystemErrorLogSchema = new mongoose.Schema({
    message: { type: String, required: true },
    stackTrace: { type: String },
    endpoint: { type: String },
    method: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    createdAt: { type: Date, default: Date.now }
});

// TTL Index: Delete error logs older than 15 days (15 * 24 * 60 * 60 seconds)
SystemErrorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 });

module.exports = mongoose.model('SystemErrorLog', SystemErrorLogSchema);
