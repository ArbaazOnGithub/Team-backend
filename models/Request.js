const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    query: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['Pending', 'Approved', 'Resolved', 'Cancelled'], default: 'Pending' },
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', RequestSchema);
