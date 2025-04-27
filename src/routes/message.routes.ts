import express from 'express';
import messageController from '@/controllers/message.controller';
import { verifyAccessToken } from '@/helper/jwt';
const router = express.Router();

router.post('/', verifyAccessToken, messageController.create);

export default router;
