const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team_app_v3';

async function fixAdmins() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB...');

        // Find all admins
        const admins = await User.find({ role: 'admin' });
        console.log(`Found ${admins.length} admins to check.`);

        let updatedCount = 0;
        for (const admin of admins) {
            // If they have a team but it's not in managedTeams, add it
            if (admin.team && !admin.managedTeams.includes(admin.team)) {
                admin.managedTeams.push(admin.team);
                await admin.save();
                updatedCount++;
                console.log(`Updated admin ${admin.name} (Mobile: ${admin.mobile}) with managed team.`);
            }
        }

        console.log(`Successfully updated ${updatedCount} admins.`);
        process.exit(0);
    } catch (err) {
        console.error('Fix failed:', err);
        process.exit(1);
    }
}

fixAdmins();
