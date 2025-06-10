import express from 'express';
import groupController from '@/controllers/group.controller';
import { verifyAccessToken } from '@/helper/jwt';

const router = express.Router();

router.post('/join/:groupId', verifyAccessToken, groupController.joinGroup);
router.get('/', groupController.getAllGroups);
router.get('/invitation-users/:groupId', verifyAccessToken, groupController.getInvitationUsers);
router.get('/:groupId/members/in-profile', groupController.getMembersOfGroupInProfile);
router.get('/:groupId/members', groupController.getMembersOfGroup);
router.get('/:id', groupController.getGroupById);
router.get('/of/:userId', groupController.getGroupsByUserId);

export default router;
