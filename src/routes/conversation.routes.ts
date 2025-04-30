import express from 'express';
import multer from 'multer';
import { verifyAccessToken } from '@/helper/jwt';
import conversationController from '@/controllers/conversation.controller';
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', conversationController.getAllConversations);
router.get('/me', verifyAccessToken, conversationController.getConversationsByMe);
router.get('/message/:conversationId', conversationController.getMessageOfConversationById);
router.get('/:conversationId', conversationController.getConversationById);

router.post('/group', verifyAccessToken, upload.single('thumbnail'), conversationController.createGroupConversation);
router.get(
    '/get-or-create/:withUserId',
    verifyAccessToken,
    conversationController.getOrCreateConversationWithSingleUser,
); // only 1-1

export default router;
