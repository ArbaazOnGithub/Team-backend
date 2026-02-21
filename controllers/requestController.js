const Request = require('../models/Request');

exports.createRequest = async (req, res) => {
    const { query, requestType, startDate, endDate, daysCount } = req.body;
    const io = req.app.get('socketio');

    if (!query || !query.trim()) return res.status(400).json({ error: 'Query empty' });
    try {
        const lastReq = await Request.findOne().sort({ requestNo: -1 });
        const requestNo = lastReq && lastReq.requestNo ? lastReq.requestNo + 1 : 101;

        let newReq = new Request({
            user: req.userId,
            query: query.trim(),
            requestNo,
            requestType: requestType || 'General',
            startDate,
            endDate,
            daysCount
        });
        await newReq.save();
        newReq = await newReq.populate('user', 'name profileImage role');
        io.emit('new_request', newReq);
        res.status(201).json(newReq);
    } catch (err) { res.status(500).json({ error: 'Error' }); }
};

exports.getRequests = async (req, res) => {
    try {
        const { status, limit = 50, page = 1 } = req.query;
        let queryFilter = status ? { status } : {};
        if (req.user.role !== 'admin') queryFilter.user = req.userId;
        const skip = (page - 1) * limit;
        const requests = await Request.find(queryFilter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .populate('user', 'name profileImage role paidLeaveBalance')
            .populate('actionBy', 'name');
        const total = await Request.countDocuments(queryFilter);
        res.json({ requests, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
    } catch (err) { res.status(500).json({ error: 'Error' }); }
};

exports.updateRequestStatus = async (req, res) => {
    const { status, comment } = req.body;
    const io = req.app.get('socketio');

    try {
        const User = require('../models/User');
        const oldRequest = await Request.findById(req.params.id);
        if (!oldRequest) return res.status(404).json({ error: 'Not found' });

        let updated = await Request.findByIdAndUpdate(
            req.params.id,
            { status, comment, actionBy: req.userId, updatedAt: new Date() },
            { new: true }
        );

        // Deduct from paidLeaveBalance if approved and it's a leave request
        if (status === 'Approved' && oldRequest.status !== 'Approved' && updated.requestType === 'Leave') {
            const userDoc = await User.findById(updated.user);
            if (!userDoc || userDoc.paidLeaveBalance < (updated.daysCount || 0)) {
                // REVERT the status update if balance is insufficient
                await Request.findByIdAndUpdate(req.params.id, { status: oldRequest.status });
                return res.status(400).json({ error: 'User does not have enough leave balance to approve this request.' });
            }

            await User.findByIdAndUpdate(updated.user, {
                $inc: { paidLeaveBalance: -(updated.daysCount || 0) }
            });
        }

        updated = await updated.populate('user', 'name profileImage role paidLeaveBalance');
        updated = await updated.populate('actionBy', 'name');
        io.emit('status_update', updated);
        res.json(updated);
    } catch (err) { res.status(500).json({ error: 'Error' }); }
};

exports.deleteRequest = async (req, res) => {
    const io = req.app.get('socketio');
    try {
        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'admin' && request.user.toString() !== req.userId.toString()) return res.status(403).json({ error: 'Unauthorized' });
        await Request.findByIdAndDelete(req.params.id);
        io.emit('request_deleted', { id: req.params.id });
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: 'Error' }); }
};

exports.getStats = async (req, res) => {
    try {
        let queryFilter = {};
        if (req.user.role !== 'admin') queryFilter.user = req.userId;
        const stats = await Request.aggregate([{ $match: queryFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
        const formattedStats = { Pending: 0, Approved: 0, Resolved: 0, Cancelled: 0 };
        stats.forEach(stat => { formattedStats[stat._id] = stat.count; });
        res.json(formattedStats);
    } catch (err) { res.status(500).json({ error: 'Error' }); }
};

exports.getDetailedStats = async (req, res) => {
    try {
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const dailyCounts = await Request.aggregate([
            { $match: { createdAt: { $gte: last7Days } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const avgResolutionTime = await Request.aggregate([
            { $match: { status: "Resolved", updatedAt: { $exists: true } } },
            {
                $group: {
                    _id: null,
                    avgTime: { $avg: { $subtract: ["$updatedAt", "$createdAt"] } }
                }
            }
        ]);

        res.json({ dailyCounts, avgResolutionTime: avgResolutionTime[0]?.avgTime || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch detailed stats" });
    }
};
