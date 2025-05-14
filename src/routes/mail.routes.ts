import express from 'express';
import mailController from '@/controllers/mail.controller';
const router = express.Router();

router.post('/send-otp', mailController.sendOTP);

export default router;
