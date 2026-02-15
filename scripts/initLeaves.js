require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team_app_v3';

async function initLeaves() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        // --- DEV CONFIGURATION ---
        // Add specific users and their current balances here
        const userBalances = {
            "user1@example.com": 15.5,
            "9876543210": 12,
            // "email_or_mobile": balance,
        };
        const defaultBalance = 10;
        // -------------------------

        const users = await User.find({});
        let updatedCount = 0;

        for (const user of users) {
            // Check mapping by email OR mobile
            const specificBalance = userBalances[user.email] || userBalances[user.mobile];
            const balanceToSet = specificBalance !== undefined ? specificBalance : defaultBalance;

            await User.findByIdAndUpdate(user._id, { $set: { paidLeaveBalance: balanceToSet } });
            console.log(`✓ Set balance to ${balanceToSet} for ${user.name} (${user.email || user.mobile})`);
            updatedCount++;
        }

        console.log(`\nSuccess: Updated ${updatedCount} users.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

initLeaves();
