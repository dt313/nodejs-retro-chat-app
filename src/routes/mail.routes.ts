import express from 'express';
import mailController from '@/controllers/mail.controller';
const router = express.Router();

router.post('/send-register-otp', mailController.sendRegisterOTP);
router.post('/send-reset-password-otp', mailController.sendResetPasswordOTP);
router.post('/verify-reset-password-otp', mailController.verifyResetPasswordOTP);

export default router;
