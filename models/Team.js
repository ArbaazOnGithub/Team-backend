const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdAt: { type: Date, default: Date.now }
});

// Ensure team names are unique within a company
TeamSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Team', TeamSchema);
