import UserSchema from '@/models/user.model';

const generateUsername = async (email: string) => {
    const username = email.split('@')[0];
    const randomString = Math.random().toString(36).substring(2, 10);
    const isExistUsername = await UserSchema.findOne({ username: `${username}-${randomString}` });
    if (isExistUsername) {
        return generateUsername(email);
    }
    return `${username}-${randomString}`;
};

export default generateUsername;
