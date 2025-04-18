import express from 'express';
import { verifyAccessToken } from '@/helper/jwt';
import conversationController from '@/controllers/conversation.controller';

const router = express.Router();

router.get('/', conversationController.getAllConversations);
router.post('/', conversationController.create);
router.get('/:id', conversationController.getConversationById);

export default router;
