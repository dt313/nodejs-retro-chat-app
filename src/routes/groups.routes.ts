import express from 'express';
import groupController from '@/controllers/group.controller';

const router = express.Router();

router.post('/join/:id', groupController.joinGroup);
router.get('/', groupController.getAllGroups);
router.get('/:id', groupController.getGroupById);

export default router;
