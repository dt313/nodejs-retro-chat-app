import express from 'express';
import { verifyAccessToken } from '@/helper/jwt';
import conversationController from '@/controllers/conversation.controller';
import { conversationThumbnailUpload } from '@/configs/multer';
const router = express.Router();

router.get('/search', verifyAccessToken, conversationController.getAllConversationsByName);
router.get('/', conversationController.getAllConversations);
router.get('/me', verifyAccessToken, conversationController.getConversationsByMe);
router.get('/forward', verifyAccessToken, conversationController.getForwardConversations);
router.put(
    '/:conversationId',
    verifyAccessToken,
    conversationThumbnailUpload.single('value'),
    conversationController.updateConversation,
);
router.post('/:conversationId/leave', verifyAccessToken, conversationController.leaveConversation);
router.get('/:conversationId', verifyAccessToken, conversationController.getConversationById);

router.get('/message/:conversationId', verifyAccessToken, conversationController.getMessageOfConversationById);
router.get(
    '/message/:conversationId/search/:messageId',
    verifyAccessToken,
    conversationController.getMessageOfConversationByMessageId,
);
router.get('/message/:conversationId/search', verifyAccessToken, conversationController.searchMessageOfConversation);

router.post(
    '/group',
    verifyAccessToken,
    conversationThumbnailUpload.single('thumbnail'),
    conversationController.createGroupConversation,
);

router.post('/group/:conversationId/delete-user', verifyAccessToken, conversationController.deleteUserFromConversation);
router.post('/group/:conversationId/change-role', verifyAccessToken, conversationController.changeRoleParticipant);
router.delete('/group/:conversationId', verifyAccessToken, conversationController.deleteGroupConversation);

router.get(
    '/get-or-create/:withUserId',
    verifyAccessToken,
    conversationController.getOrCreateConversationWithSingleUser,
); // only 1-1

router.get('/read-last-message/:conversationId', verifyAccessToken, conversationController.readLastMessage); // only 1-1

export default router;
