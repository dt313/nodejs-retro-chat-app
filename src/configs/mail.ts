const nodemailer = require('nodemailer');
import config from '@/configs/config';

console.log(config.emailUser, config.emailPass);
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.emailUser,
        pass: config.emailPass,
    },
});

export default transporter;
