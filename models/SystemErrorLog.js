const mongoose = require('mongoose');

const SystemErrorLogSchema = new mongoose.Schema({
    message: { type: String, required: true },
    stackTrace: { type: String },
    endpoint: { type: String },
    method: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SystemErrorLog', SystemErrorLogSchema);
