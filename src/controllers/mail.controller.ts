import { Status } from '@/types/response';
import { errorResponse, successResponse } from '@/utils/response';
import { NextFunction, Request, Response } from 'express';
import config from '@/configs/config';
import transporter from '@/configs/mail';
import { client as redisClient } from '@/configs/redis';

import { generateNumericOTP } from '@/helper';
class MailController {
    async sendRegisterOTP(req: Request, res: Response, next: NextFunction) {
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
                subject: 'Mã xác nhận đăng ký tài khoản',
                text: 'Vui lòng xác nhận mã OTP của bạn.',
                html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                        <h2 style="color: #2c3e50;">Chào mừng bạn đến với Retro Chat!</h2>
                        <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Retro Chat</strong>.</p>
                        <p>Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã xác nhận dưới đây:</p>
                        <div style="font-size: 24px; font-weight: bold; background-color: #f1f1f1; padding: 10px 20px; display: inline-block; border-radius: 6px; margin-top: 10px;">
                            ${otpCode}
                        </div>
                        <p style="margin-top: 20px;">Mã xác nhận có hiệu lực trong vòng <strong>5 phút</strong>.</p>
                        <p>Nếu bạn không thực hiện yêu cầu đăng ký tài khoản này, vui lòng bỏ qua email.</p>
                        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
                        <p style="font-size: 12px; color: #888;">Email này được gửi tự động từ hệ thống Retro Chat. Vui lòng không trả lời email này.</p>
                    </div>`,
            };

            const isSend = await transporter.sendMail(mailOptions);

            if (isSend) {
                redisClient.set(`${email}-register-otp`, otpCode, { EX: 300 });

                res.status(Status.OK).json(successResponse(Status.OK, 'Email sent successfully', true));
            } else {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Email sent failed'));
            }
        } catch (error) {
            next(error);
        }
    }

    async sendResetPasswordOTP(req: Request, res: Response, next: NextFunction) {
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
                subject: 'Mã xác nhận đặt lại mật khẩu',
                text: 'Vui lòng xác nhận mã OTP của bạn.',
                html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2 style="color: #2c3e50;">Yêu cầu đặt lại mật khẩu từ Retro Chat</h2>
                    <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                    <p>Dưới đây là mã xác nhận để đặt lại mật khẩu:</p>
                    <div style="font-size: 24px; font-weight: bold; background-color: #f1f1f1; padding: 10px 20px; display: inline-block; border-radius: 6px;">
                        ${otpCode}
                    </div>
                    <p style="margin-top: 20px;">Mã xác nhận này sẽ hết hạn sau 5 phút.</p>
                    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ với bộ phận hỗ trợ.</p>
                    <hr>
                    <p style="font-size: 12px; color: #888;">Email này được gửi tự động từ hệ thống. Vui lòng không trả lời.</p>
                </div>`,
            };

            const isSend = await transporter.sendMail(mailOptions);

            if (isSend) {
                redisClient.set(`${email}-reset-password-otp`, otpCode, { EX: 300 });
                res.status(Status.OK).json(successResponse(Status.OK, 'Email sent successfully', true));
            } else {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Email sent failed'));
            }
        } catch (error) {
            next(error);
        }
    }

    async verifyResetPasswordOTP(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, code } = req.body;
            console.log(email, code);
            if (!email || !code) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Email and OTP are required'));
                return;
            }

            const otpCode = await redisClient.get(`${email}-reset-password-otp`);
            if (otpCode !== code) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid OTP'));
                return;
            }

            res.status(Status.OK).json(successResponse(Status.OK, 'OTP verified successfully', true));
        } catch (error) {
            next(error);
        }
    }
}
export default new MailController();
