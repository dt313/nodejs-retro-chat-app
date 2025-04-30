import dotenv from 'dotenv';
import path from 'path';

const NODE_ENV = process.env.NODE_ENV || 'development';

const envFilePath = path.resolve(__dirname, `../../.env.${NODE_ENV}`);

dotenv.config({ path: envFilePath });

interface Config {
    port: number;
    nodeEnv: string;
    databaseUrl: string;
    corsOrigin: string;
    apiBasePath: string;
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiresIn: string;
    refreshTokenExpiresIn: string;
    refreshTokenPath: string;
    googleClientId: string;
    googleClientSecret: string;
    googleRedirectUri: string;
    githubClientId: string;
    githubClientSecret: string;
    githubRedirectUri: string;
    facebookClientId: string;
    facebookClientSecret: string;
    facebookRedirectUri: string;
    cookieDomain: string;
    cookieMaxAge: number;
    redisUrl: string;
    cloudinaryCloudName: string;
    cloudinaryApiKey: string;
    cloudinaryApiSecret: string;
}

const config: Config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || '',
    corsOrigin: process.env.CORS_ORIGIN || '',
    apiBasePath: process.env.API_BASE_PATH || '',
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || '',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || '',
    accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '1d',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    refreshTokenPath: process.env.REFRESH_TOKEN_PATH || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleRedirectUri: `${process.env.DOMAIN}${process.env.API_BASE_PATH}${process.env.GOOGLE_REDIRECT_URI}` || '',
    githubClientId: process.env.GITHUB_CLIENT_ID || '',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    githubRedirectUri: `${process.env.DOMAIN}${process.env.API_BASE_PATH}${process.env.GITHUB_REDIRECT_URI}` || '',
    facebookClientId: process.env.FACEBOOK_CLIENT_ID || '',
    facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    facebookRedirectUri: `${process.env.DOMAIN}${process.env.API_BASE_PATH}${process.env.FACEBOOK_REDIRECT_URI}` || '',
    cookieDomain: process.env.COOKIE_DOMAIN || '',
    cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || '0') || 60000,
    redisUrl: process.env.REDIS_URL || '',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
};

export default config;
