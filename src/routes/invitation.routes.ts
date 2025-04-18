import express from 'express';
import invitationController from '@/controllers/invitation.controller';

const router = express.Router();

// group invitation
router.get('/group/:userId', invitationController.getAllInvitationsOfGroupByUserId);
router.post('/group/:id', invitationController.createGroupInvitation);
router.get('/group/reply/:id', invitationController.replyInvitation);

// friend add request
router.get('/user/:userId', invitationController.getAllFriendRequestsByUserId);
router.post('/user/:userId', invitationController.createFriendRequest);
router.post('/user/reply/:id', invitationController.replyFriendRequest);
export default router;
