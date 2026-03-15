const superadminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Super Admins only.' });
    }
};

module.exports = superadminMiddleware;
