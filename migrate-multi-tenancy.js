const mongoose = require('mongoose');
const Company = require('./models/Company');
const User = require('./models/User');
const Request = require('./models/Request');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const AuditLog = require('./models/AuditLog');
const SystemErrorLog = require('./models/SystemErrorLog');

require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI;

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB...");

        // 1. Create Default Company
        let company = await Company.findOne({ slug: 'turbo-net' });
        if (!company) {
            company = await Company.create({
                name: 'Turbo Net',
                slug: 'turbo-net',
                settings: { themeColor: '#68BA7F' }
            });
            console.log("Created Turbo Net company.");
        }

        const companyId = company._id;

        // 2. Update All Models
        const resultUsers = await User.updateMany({ company: { $exists: false } }, { $set: { company: companyId } });
        console.log(`Updated ${resultUsers.modifiedCount} users.`);

        const resultRequests = await Request.updateMany({ company: { $exists: false } }, { $set: { company: companyId } });
        console.log(`Updated ${resultRequests.modifiedCount} requests.`);

        const resultMessages = await Message.updateMany({ company: { $exists: false } }, { $set: { company: companyId } });
        console.log(`Updated ${resultMessages.modifiedCount} messages.`);

        const resultNotifications = await Notification.updateMany({ company: { $exists: false } }, { $set: { company: companyId } });
        console.log(`Updated ${resultNotifications.modifiedCount} notifications.`);

        const resultAudit = await AuditLog.updateMany({ company: { $exists: false } }, { $set: { company: companyId } });
        console.log(`Updated ${resultAudit.modifiedCount} audit logs.`);

        const resultErrors = await SystemErrorLog.updateMany({ company: { $exists: false } }, { $set: { company: companyId } });
        console.log(`Updated ${resultErrors.modifiedCount} error logs.`);

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
