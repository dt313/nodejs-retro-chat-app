import express from 'express';
import attachmentController from '@/controllers/attachment.controller';
import { verifyAccessToken } from '@/helper/jwt';

const router = express.Router();
router.get('/images/:conversationId', verifyAccessToken, attachmentController.getAllImagesOfConversation);
router.get('/files/:conversationId', verifyAccessToken, attachmentController.getAllFilesOfConversation);
router.get('/videos/:conversationId', verifyAccessToken, attachmentController.getAllVideosOfConversation);

export default router;
