import express from 'express';
import messageController from '@/controllers/message.controller';
import { verifyAccessToken } from '@/helper/jwt';
import { attachmentsUpload } from '@/configs/multer';

const router = express.Router();

router.post('/to/:conversationId', verifyAccessToken, attachmentsUpload.array('attachments'), messageController.create);
router.post('/reaction/cancel/:reactionId', verifyAccessToken, messageController.cancelReaction);
router.post('/reaction/:messageId', verifyAccessToken, messageController.reaction);
router.post('/forward/:messageId', verifyAccessToken, messageController.forwardMessage);
router.delete('/:type/:messageId', verifyAccessToken, messageController.deleteMessage);
export default router;
