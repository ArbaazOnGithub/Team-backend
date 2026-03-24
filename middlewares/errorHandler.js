const SystemErrorLog = require('../models/SystemErrorLog');

const errorHandler = async (err, req, res, next) => {
    console.error('Unhandled System Error:', err);

    try {
        await SystemErrorLog.create({
            message: err.message || 'Unknown Server Error',
            stackTrace: err.stack || '',
            endpoint: req.originalUrl,
            method: req.method,
            user: req.user ? req.user._id : null
        });
    } catch (logErr) {
        console.error('Failed to save to SystemErrorLog:', logErr);
    }

    // Ensure CORS headers are present even on errors
    const origin = req.get('origin');
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.status(500).json({ 
        error: 'An unexpected system error occurred.',
        details: err.message
    });
};

module.exports = errorHandler;
