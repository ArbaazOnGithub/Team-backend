const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
    requestNo: { type: Number },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    query: { type: String, required: true, trim: true, maxlength: 1000 },
    requestType: { type: String, enum: ['General', 'Leave'], default: 'General' },
    startDate: { type: Date },
    endDate: { type: Date },
    daysCount: { type: Number },
    status: { type: String, enum: ['Pending', 'Approved', 'Resolved', 'Cancelled'], default: 'Pending' },
    comment: { type: String, default: "" },
    attachmentUrl: { type: String }, // URL for photos/documents
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', RequestSchema);
