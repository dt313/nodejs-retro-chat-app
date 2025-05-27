import axios from 'axios';
import queryString from 'query-string';
import { Request, Response, NextFunction } from 'express';
import UserSchema from '@/models/user.model';
import crypto from 'crypto';
import { Status } from '@/types/response';
import { userValidate } from '@/validation';
import { errorResponse, successResponse } from '@/utils/response';
import { generateToken } from '@/helper/jwt';
import { generateUsername, splitFullName, verifyPassword } from '@/helper';
import config from '@/configs/config';
import { AuthRequest } from '@/types/auth-request';
import { client as redisClient } from '@/configs/redis';

class AuthController {
    private readonly FACEBOOK_URL = `https://www.facebook.com/v22.0/dialog/oauth?
    client_id=${config.facebookClientId}&
    redirect_uri=${config.facebookRedirectUri}`;

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const result = userValidate.loginUser.safeParse(req.body);
            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const user = await UserSchema.findOne({ email: result.data.email });
            if (!user) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Không tìm thấy người dùng'));
                return;
            }

            const isValidPassword = await verifyPassword(result.data.password, user.password);
            if (!isValidPassword) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'Mật khẩu không chính xác'));
                return;
            }

            const accessToken = await generateToken(user._id.toString(), 'access');
            const refreshToken = await generateToken(user._id.toString(), 'refresh');

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                maxAge: config.cookieMaxAge,
                path: config.refreshTokenPath,
                domain: config.cookieDomain,
            });

            res.status(Status.OK).json(successResponse(Status.OK, 'Login successfully', { user, accessToken }));
        } catch (error) {
            next(error);
        }
    }

    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, code } = req.body;

            const result = userValidate.registerUser.safeParse(req.body);
            const isExistEmail = await UserSchema.findOne({ email: req.body.email });
            if (isExistEmail) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Email này đã được sử dụng'));
                return;
            }

            if (!result.success) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'Validation Error', result.error),
                );
                return;
            }

            const otpCode = await redisClient.get(`${email}-register-otp`);
            if (Number(otpCode) !== Number(code)) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Invalid OTP code'));
                return;
            }

            const { firstName, lastName } = splitFullName(result.data.fullName);
            const username = await generateUsername(result.data.email);
            const user = await UserSchema.create({
                ...result.data,
                firstName,
                lastName,
                username,
            });

            res.status(Status.CREATED).json(successResponse(Status.CREATED, 'Register successfully', { user }));
        } catch (error) {
            next(error);
        }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
        } catch (error) {
            next(error);
        }
    }

    async refreshToken(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.payload?.userId;

            if (userId) {
                const accessToken = await generateToken(userId, 'access');
                res.status(Status.OK).json(successResponse(Status.OK, 'Refresh token successfully', { accessToken }));
                return;
            }

            res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Refresh token failed'));
            return;
        } catch (error) {
            next(error);
        }
    }

    async googleOAuth(req: Request, res: Response, next: NextFunction) {
        try {
            const googleUrl =
                `https://accounts.google.com/o/oauth2/v2/auth` +
                `?client_id=${config.googleClientId}` +
                `&redirect_uri=${config.googleRedirectUri}` +
                `&response_type=code` +
                `&scope=email%20profile`;
            res.redirect(googleUrl);
        } catch (error) {
            next(error);
        }
    }

    async githubOAuth(req: Request, res: Response, next: NextFunction) {
        try {
            const params = queryString.stringify({
                client_id: config.githubClientId,
                redirect_uri: config.githubRedirectUri,
                response_type: 'code',
                scope: ['read:user', 'user:email'].join(' '),
                allow_signup: true,
            });

            const githubUrl = `https://github.com/login/oauth/authorize?${params}`;

            res.redirect(githubUrl);
        } catch (error) {
            next(error);
        }
    }
    async facebookOAuth(req: Request, res: Response, next: NextFunction) {
        try {
            res.redirect(this.FACEBOOK_URL);
        } catch (error) {
            next(error);
        }
    }

    async googleOAuthCallback(req: Request, res: Response, next: NextFunction) {
        try {
            const { code } = req.query;
            if (code) {
                const { data } = await axios.post('https://oauth2.googleapis.com/token', {
                    client_id: config.googleClientId,
                    client_secret: config.googleClientSecret,
                    code,
                    redirect_uri: config.googleRedirectUri,
                    grant_type: 'authorization_code',
                });

                const { access_token } = data;

                const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
                    headers: { Authorization: `Bearer ${access_token}` },
                });

                const { email, name, picture } = profile;

                let accessToken = '';
                let refreshToken = '';
                const user = await UserSchema.findOne({ email });

                if (!user) {
                    const { firstName, lastName } = splitFullName(name);
                    const username = await generateUsername(email);
                    const newUser = await UserSchema.create({
                        email,
                        fullName: name,
                        firstName,
                        lastName,
                        username,
                        avatar: picture,
                        password: crypto.randomBytes(32).toString('hex'),
                    });

                    accessToken = await generateToken(newUser._id.toString(), 'access');
                    refreshToken = await generateToken(newUser._id.toString(), 'refresh');
                    res.cookie('refreshToken', refreshToken, {
                        httpOnly: true,
                        maxAge: config.cookieMaxAge,
                        path: config.refreshTokenPath,
                        domain: config.cookieDomain,
                    });
                    res.redirect(`${config.corsOrigin}/oauth2?token=${accessToken}`);
                    return;
                } else {
                    accessToken = await generateToken(user._id.toString(), 'access');
                    refreshToken = await generateToken(user._id.toString(), 'refresh');
                    res.cookie('refreshToken', refreshToken, {
                        httpOnly: true,
                        maxAge: config.cookieMaxAge,
                        path: config.refreshTokenPath,
                        domain: config.cookieDomain,
                    });
                    res.redirect(`${config.corsOrigin}/oauth2?token=${accessToken}`);
                    return;
                }
            } else {
                res.redirect(`${config.corsOrigin}/oauth2?token=null`);
            }
        } catch (error) {
            next(error);
        }
    }

    async githubOAuthCallback(req: Request, res: Response, next: NextFunction) {
        try {
            const { code } = req.query;

            if (code) {
                const { data } = await axios({
                    url: 'https://github.com/login/oauth/access_token',
                    method: 'get',
                    params: {
                        client_id: config.githubClientId,
                        client_secret: config.githubClientSecret,
                        redirect_uri: config.githubRedirectUri,
                        code,
                    },
                });

                const parsedData = queryString.parse(data);
                const { access_token } = parsedData;

                const { data: profile } = await axios.get('https://api.github.com/user', {
                    headers: { Authorization: `Bearer ${access_token}` },
                });

                const { email, name, avatar_url } = profile;
                let accessToken = '';
                let refreshToken = '';
                const user = await UserSchema.findOne({ email });

                if (!user) {
                    const { firstName, lastName } = splitFullName(name);
                    const username = await generateUsername(email);
                    const newUser = await UserSchema.create({
                        email,
                        fullName: name,
                        firstName,
                        lastName,
                        username,
                        avatar: avatar_url,
                        password: crypto.randomBytes(32).toString('hex'),
                    });

                    accessToken = await generateToken(newUser._id.toString(), 'access');
                    refreshToken = await generateToken(newUser._id.toString(), 'refresh');
                    res.cookie('refreshToken', refreshToken, {
                        httpOnly: true,
                        maxAge: config.cookieMaxAge,
                        path: config.refreshTokenPath,
                        domain: config.cookieDomain,
                    });
                    res.redirect(`${config.corsOrigin}/oauth2?token=${accessToken}`);
                    return;
                } else {
                    accessToken = await generateToken(user._id.toString(), 'access');
                    refreshToken = await generateToken(user._id.toString(), 'refresh');
                    res.cookie('refreshToken', refreshToken, {
                        httpOnly: true,
                        maxAge: config.cookieMaxAge,
                        path: config.refreshTokenPath,
                        domain: config.cookieDomain,
                    });
                    res.redirect(`${config.corsOrigin}/oauth2?token=${accessToken}`);
                    return;
                }
            } else {
                res.redirect(`${config.corsOrigin}/oauth2?token=null`);
            }
        } catch (error) {
            next(error);
        }
    }

    async facebookOAuthCallback(req: Request, res: Response, next: NextFunction) {
        try {
        } catch (error) {
            next(error);
        }
    }
}

export default new AuthController();
