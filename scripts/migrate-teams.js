const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Models
const Company = require('../models/Company');
const Team = require('../models/Team');
const User = require('../models/User');
const Request = require('../models/Request');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team_app_v3';

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB for migration...');

        const companies = await Company.find();
        console.log(`Found ${companies.length} companies.`);

        for (const company of companies) {
            console.log(`Processing company: ${company.name}`);

            // 1. Create "First Team" if it doesn't exist
            let firstTeam = await Team.findOne({ company: company._id, name: 'First Team' });
            if (!firstTeam) {
                firstTeam = await Team.create({ name: 'First Team', company: company._id });
                console.log(`Created "First Team" for ${company.name}`);
            } else {
                console.log(`"First Team" already exists for ${company.name}`);
            }

            // 2. Update Users
            const userUpdate = await User.updateMany(
                { company: company._id, team: { $exists: false } },
                { $set: { team: firstTeam._id } }
            );
            console.log(`Updated ${userUpdate.modifiedCount} users.`);

            // 3. Update Requests
            const requestUpdate = await Request.updateMany(
                { company: company._id, team: { $exists: false } },
                { $set: { team: firstTeam._id } }
            );
            console.log(`Updated ${requestUpdate.modifiedCount} requests.`);

            // 4. Update Messages
            const messageUpdate = await Message.updateMany(
                { company: company._id, team: { $exists: false } },
                { $set: { team: firstTeam._id } }
            );
            console.log(`Updated ${messageUpdate.modifiedCount} messages.`);

            // 5. Update Notifications
            const notificationUpdate = await Notification.updateMany(
                { company: company._id, team: { $exists: false } },
                { $set: { team: firstTeam._id } }
            );
            console.log(`Updated ${notificationUpdate.modifiedCount} notifications.`);

            // 6. Update AuditLogs
            const auditLogUpdate = await AuditLog.updateMany(
                { company: company._id, team: { $exists: false } },
                { $set: { team: firstTeam._id } }
            );
            console.log(`Updated ${auditLogUpdate.modifiedCount} audit logs.`);
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
