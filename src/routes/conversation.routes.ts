import express from 'express';
import { verifyAccessToken } from '@/helper/jwt';
import conversationController from '@/controllers/conversation.controller';
const router = express.Router();

router.get('/', conversationController.getAllConversations);
router.post('/', verifyAccessToken, conversationController.create);
router.get('/me', verifyAccessToken, conversationController.getConversationsByMe);
router.get('/message/:conversationId', conversationController.getMessageOfConversationById);
router.get('/:conversationId', conversationController.getConversationById);

export default router;
