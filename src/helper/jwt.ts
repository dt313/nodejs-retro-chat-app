import { errorResponse } from '@/utils/response';
import { Status } from '@/types/response';
import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types/auth-request';
import jwt, { SignOptions } from 'jsonwebtoken';
import { client as redisClient } from '@/configs/redis';
import config from '@/configs/config';

export const generateToken = async (userId: string, type: 'access' | 'refresh' = 'access'): Promise<string> => {
    return new Promise((resolve, reject) => {
        const payload = { userId };
        const secret = type === 'access' ? config.accessTokenSecret : config.refreshTokenSecret;
        const options: SignOptions = {
            expiresIn:
                type === 'access'
                    ? (config.accessTokenExpiresIn as jwt.SignOptions['expiresIn'])
                    : (config.refreshTokenExpiresIn as jwt.SignOptions['expiresIn']),
        };

        jwt.sign(payload, secret, options, (err, token) => {
            if (err) reject(err);
            else if (token) {
                redisClient.set(`${userId}-${type}`, token, { EX: config.cookieMaxAge });
                resolve(token);
            } else {
                reject(new Error('Failed to generate token'));
            }
        });
    });
};

export const verifyAccessToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.headers['authorization']) {
            return next(errorResponse(Status.UNAUTHORIZED, 'Unauthorized'));
        }

        const authHeader = req.headers['authorization'];
        const token = authHeader.split(' ')[1];

        jwt.verify(token, config.accessTokenSecret, (err: any, payload: any) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return next(errorResponse(Status.UNAUTHORIZED, 'Token Expired'));
                }
                return next(errorResponse(Status.UNAUTHORIZED, 'Invalid Access Token'));
            }

            req.payload = payload as { userId: string };
        });

        console.log('verify token ', token, req.payload);

        const redisToken = await redisClient.get(`${req.payload?.userId}-access`);
        if (redisToken !== token) {
            return next(errorResponse(Status.UNAUTHORIZED, 'Invalid Access Token'));
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

export const verifyRefreshToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.cookies.refreshToken) {
            return next(errorResponse(Status.UNAUTHORIZED, 'Unauthorized'));
        }

        const token = req.cookies.refreshToken;

        jwt.verify(token, config.refreshTokenSecret, (err: any, payload: any) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return next(errorResponse(Status.UNAUTHORIZED, 'Token Expired'));
                }

                return next(errorResponse(Status.UNAUTHORIZED, 'Invalid Refresh Token'));
            }

            req.payload = payload as { userId: string };
        });

        const redisToken = await redisClient.get(`${req.payload?.userId}-refresh`);
        if (redisToken !== token) {
            return next(errorResponse(Status.UNAUTHORIZED, 'Invalid Refresh Token'));
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

export const getUserIdFromAccessToken = async (token: string) => {
    let userId: string | null = null;
    try {
        jwt.verify(token, config.accessTokenSecret, (err: any, payload: any) => {
            if (err) {
                console.log('Error: ', err);
                return null;
            }

            userId = payload.userId;
        });

        const redisToken = await redisClient.get(`${userId}-access`);
        if (redisToken !== token) {
            console.log('Redis Token Invalid ');

            return null;
        }

        return userId;
    } catch (error) {
        return null;
    }
};
