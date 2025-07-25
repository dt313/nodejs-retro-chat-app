import express from 'express';
import invitationController from '@/controllers/invitation.controller';
import { verifyAccessToken } from '@/helper/jwt';
const router = express.Router();

// group invitation
router.get('/group/:userId', invitationController.getAllInvitationsOfGroupByUserId);
router.post('/group/:groupId/to/:userId', verifyAccessToken, invitationController.createGroupInvitation);
router.post('/group/reply', verifyAccessToken, invitationController.replyGroupInvitation);
router.get('/group/accept/:groupId', verifyAccessToken, invitationController.acceptGroupInvitation);
router.post('/group/cancel/:toUserId', verifyAccessToken, invitationController.cancelGroupInvitation);

// friend add request
router.post('/user/reply', verifyAccessToken, invitationController.replyFriendRequest);
router.get('/user/:userId', invitationController.getAllFriendRequestsByUserId);
router.post('/user/:to', verifyAccessToken, invitationController.createFriendRequest);
router.post('/user/cancel/:toUserId', verifyAccessToken, invitationController.cancelFriendRequest);
router.post('/user/unfriend/:toUserId', verifyAccessToken, invitationController.unFriend);
export default router;
