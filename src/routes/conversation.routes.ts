import express from 'express';
import { verifyAccessToken } from '@/helper/jwt';
import conversationController from '@/controllers/conversation.controller';
import { conversationThumbnailUpload } from '@/configs/multer';
const router = express.Router();

router.get('/', conversationController.getAllConversations);
router.get('/me', verifyAccessToken, conversationController.getConversationsByMe);
router.get('/message/:conversationId', verifyAccessToken, conversationController.getMessageOfConversationById);
router.get('/:conversationId', verifyAccessToken, conversationController.getConversationById);

router.post(
    '/group',
    verifyAccessToken,
    conversationThumbnailUpload.single('thumbnail'),
    conversationController.createGroupConversation,
);
router.get(
    '/get-or-create/:withUserId',
    verifyAccessToken,
    conversationController.getOrCreateConversationWithSingleUser,
); // only 1-1

router.get('/read-last-message/:conversationId', verifyAccessToken, conversationController.readLastMessage); // only 1-1

export default router;
