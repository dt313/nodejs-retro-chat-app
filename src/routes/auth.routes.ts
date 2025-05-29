import express from 'express';
import authController from '@/controllers/auth.controller';
import { verifyRefreshToken } from '@/helper/jwt';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/refresh-token', verifyRefreshToken, authController.refreshToken);
router.get('/google', authController.googleOAuth);
router.get('/oauth2/callback/google', authController.googleOAuthCallback);
router.get('/github', authController.githubOAuth);
router.get('/oauth2/callback/github', authController.githubOAuthCallback);
router.get('/facebook', authController.facebookOAuth);
router.get('/oauth2/callback/facebook', authController.facebookOAuthCallback);

export default router;
