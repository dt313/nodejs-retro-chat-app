import express from 'express';
import { verifyAccessToken } from '@/helper/jwt';
import conversationController from '@/controllers/conversation.controller';
const router = express.Router();

router.get('/', conversationController.getAllConversations);
router.get('/me', verifyAccessToken, conversationController.getConversationsByMe);
router.get('/message/:conversationId', conversationController.getMessageOfConversationById);
router.get('/:conversationId', conversationController.getConversationById);

router.post('/group', verifyAccessToken, conversationController.createGroupConversation);
router.get(
    '/get-or-create/:withUserId',
    verifyAccessToken,
    conversationController.getOrCreateConversationWithSingleUser,
); // only 1-1

export default router;
