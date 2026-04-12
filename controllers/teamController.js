const Team = require('../models/Team');
const { logAction } = require('../utils/logger');

exports.createTeam = async (req, res) => {
    try {
        const { name, companyId } = req.body;
        if (!name || !companyId) return res.status(400).json({ error: 'Name and companyId are required' });

        const existing = await Team.findOne({ name, company: companyId });
        if (existing) return res.status(400).json({ error: 'Team name already exists in this company' });

        const team = await Team.create({ name, company: companyId });
        await logAction(req.userId, `Created team: ${name}`, 'admin', { teamId: team._id, companyId }, req.userCompany);

        res.status(201).json(team);
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
};

exports.getTeamsByCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const teams = await Team.find({ company: companyId }).sort({ name: 1 });
        res.json(teams);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
};

exports.updateTeam = async (req, res) => {
    try {
        const { name } = req.body;
        const team = await Team.findByIdAndUpdate(req.params.id, { name }, { new: true });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        await logAction(req.userId, `Updated team name to: ${name}`, 'admin', { teamId: team._id }, req.userCompany);
        res.json(team);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update team' });
    }
};

exports.deleteTeam = async (req, res) => {
    try {
        const teamId = req.params.id;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check if users belong to this team
        const User = require('../models/User');
        const userCount = await User.countDocuments({ team: teamId });
        if (userCount > 0) {
            return res.status(400).json({ error: 'Cannot delete team with assigned users. Move users first.' });
        }

        await Team.findByIdAndDelete(teamId);
        await logAction(req.userId, `Deleted team: ${team.name}`, 'admin', { teamId }, req.userCompany);

        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete team' });
    }
};
