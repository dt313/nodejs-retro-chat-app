import bcrypt from 'bcrypt';

const verifyPassword = async (password: string, hashedPassword: string) => {
    return await bcrypt.compare(password, hashedPassword);
};

export default verifyPassword;
