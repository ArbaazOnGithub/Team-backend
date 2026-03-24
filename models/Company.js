const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g., 'turbo-net'
    logo: { type: String, default: '' },
    settings: {
        allowRegistration: { type: Boolean, default: true },
        themeColor: { type: String, default: '#68BA7F' }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', CompanySchema);
