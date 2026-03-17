const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    profileImage: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
    paidLeaveBalance: { type: Number, default: 0 },

    // Fields for Password Reset
    resetOtp: { type: String },
    resetOtpExpire: { type: Date },

    createdAt: { type: Date, default: Date.now }
});

// Enforce that only '9399285780' can be a superadmin
UserSchema.pre('save', async function () {
    if (this.role === 'superadmin' && this.mobile !== '9399285780') {
        throw new Error("Only the developer account can be a superadmin.");
    }
});

UserSchema.pre('findOneAndUpdate', async function () {
    const update = this.getUpdate();
    if (update && update.role === 'superadmin') {
        const query = this.getQuery();
        if (query.mobile !== '9399285780') {
            throw new Error("Only the developer account can be a superadmin.");
        }
    }
});

UserSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.resetOtp;
    delete obj.resetOtpExpire;
    return obj;
};

module.exports = mongoose.model('User', UserSchema);
