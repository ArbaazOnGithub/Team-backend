const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        const user = await User.findById(decoded.userId);

        if (!user) return res.status(401).json({ error: 'User not found' });

        req.user = user;
        req.userId = user._id;
        
        // --- GLOBAL CONTEXT SWITCHER: COMPANY ---
        const contextCompanyId = req.header('x-company-context');
        if (contextCompanyId && user.role === 'superadmin') {
            req.userCompany = contextCompanyId;
        } else {
            req.userCompany = user.company;
        }

        // --- GLOBAL CONTEXT SWITCHER: TEAM ---
        const teamContextId = req.header('x-team-context');
        if (teamContextId) {
            // Validate if user belongs to this team OR manages it
            const isMember = user.team?.toString() === teamContextId;
            const isManager = user.managedTeams?.some(t => t.toString() === teamContextId);
            
            if (isMember || isManager) {
                req.activeTeam = teamContextId;
                req.isManagerMode = isManager && user.role === 'admin';
            } else {
                req.activeTeam = user.team; // Fallback to primary
                req.isManagerMode = false;
            }
        } else {
            req.activeTeam = user.team;
            req.isManagerMode = false;
        }
        
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
