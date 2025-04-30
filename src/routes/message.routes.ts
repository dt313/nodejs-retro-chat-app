import express from 'express';
import messageController from '@/controllers/message.controller';
import { verifyAccessToken } from '@/helper/jwt';
import { attachmentsUpload } from '@/configs/multer';

const router = express.Router();

router.post('/to/:conversationId', verifyAccessToken, attachmentsUpload.array('attachments'), messageController.create);

export default router;
