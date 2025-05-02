import { AuthRequest } from '@/types/auth-request';
import UserSchema from '@/models/user.model';
import ConversationSchema from '@/models/conversation.model';
import ImageAttachmentSchema from '@/models/images-attachment.model';
import AttachmentSchema from '@/models/attachment.model';

import { Request, Response, NextFunction } from 'express';
import { errorResponse, successResponse } from '@/utils/response';
import { Status } from '@/types/response';
import ParticipantSchema from '@/models/participant.model';

class AttachmentController {
    async getAllImagesOfConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;

            const isExistUser = await UserSchema.findById(meId);
            if (!isExistUser) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'User is not found'));
                return;
            }

            const isExistConversation = await ConversationSchema.findById(conversationId);
            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            // is participant

            const isParticipant = await ParticipantSchema.findOne({ user: meId, conversationId });
            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not member in this conversation'),
                );
                return;
            }

            const imagesSchema = await ImageAttachmentSchema.find({ conversationId });

            const allImages = imagesSchema.flatMap((item) => item.images);

            res.status(Status.OK).json(
                successResponse(Status.OK, 'Get images of conversation successfully', allImages),
            );
            return;
        } catch (error) {
            next(error);
        }
    }

    async getAllFilesOfConversation(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;

            const isExistUser = await UserSchema.findById(meId);
            if (!isExistUser) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'User is not found'));
                return;
            }

            const isExistConversation = await ConversationSchema.findById(conversationId);
            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            // is participant

            const isParticipant = await ParticipantSchema.findOne({ user: meId, conversationId });
            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not member in this conversation'),
                );
                return;
            }

            const files = await AttachmentSchema.find({ conversationId }).select('name url size');

            res.status(Status.OK).json(successResponse(Status.OK, 'Get files of conversation successfully', files));
            return;
        } catch (error) {
            next(error);
        }
    }
}
export default new AttachmentController();
