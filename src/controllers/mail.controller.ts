import { Status } from '@/types/response';
import { errorResponse, successResponse } from '@/utils/response';
import { NextFunction, Request, Response } from 'express';
import config from '@/configs/config';
import transporter from '@/configs/mail';
import { client as redisClient } from '@/configs/redis';

import { generateNumericOTP } from '@/helper';
class MailController {
    async sendOTP(req: Request, res: Response, next: NextFunction) {
        try {
            const { email } = req.body;

            if (!email) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Email is required'));
                return;
            }

            const otpCode = generateNumericOTP(6);

            const mailOptions = {
                from: config.emailUser,
                to: email,
                subject: 'Test Email',
                text: 'Vui lòng xác nhận mã OTP của bạn.',
                html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2 style="color: #2c3e50;">Chào mừng bạn đến với Retro Chat!</h2>
                    <p>Cảm ơn bạn đã đăng ký tài khoản.</p>
                    <p>Dưới đây là mã xác nhận của bạn:</p>
                    <div style="font-size: 24px; font-weight: bold; background-color: #f1f1f1; padding: 10px 20px; display: inline-block; border-radius: 6px;">
                        ${otpCode} <!-- Biến chứa mã xác nhận -->
                    </div>
                    <p style="margin-top: 20px;">Mã xác nhận này sẽ hết hạn sau 5 phút.</p>
                    <p>Nếu bạn không yêu cầu đăng ký, vui lòng bỏ qua email này.</p>
                    <hr>
                    <p style="font-size: 12px; color: #888;">Email này được gửi tự động từ hệ thống. Vui lòng không trả lời.</p>
                    </div>`,
            };

            const isSend = await transporter.sendMail(mailOptions);

            if (isSend) {
                redisClient.set(`${email}-otp`, otpCode, { EX: 300 });

                res.status(Status.OK).json(successResponse(Status.OK, 'Email sent successfully'));
            } else {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Email sent failed'));
            }

            res.status(Status.OK).json(successResponse(Status.OK, 'Email sent successfully'));
        } catch (error) {
            next(error);
        }
    }
}
export default new MailController();
