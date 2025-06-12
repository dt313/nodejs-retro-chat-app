import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const Schema = mongoose.Schema;

const UserSchema = new Schema(
    {
        firstName: { type: String },
        lastName: { type: String },
        fullName: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        avatar: { type: String, default: '', required: false },
        bio: { type: String, default: '', require: false },
        website: { type: String, default: '', require: false },
        fbLink: { type: String, default: '', require: false },
        ghLink: { type: String, default: '', require: false },
        lkLink: { type: String, default: '', require: false },
        igLink: { type: String, default: '', require: false },
    },
    { timestamps: true },
);

UserSchema.pre('save', async function (next) {
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});

const User = mongoose.model('User', UserSchema);

export default User;
