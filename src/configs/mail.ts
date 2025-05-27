const nodemailer = require('nodemailer');
import config from '@/configs/config';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.emailUser,
        pass: config.emailPass,
    },
});

export default transporter;
