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

    res.status(500).json({ error: 'An unexpected system error occurred. Our team has been notified.' });
};

module.exports = errorHandler;
