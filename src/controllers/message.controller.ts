import { getMessageType } from '@/helper';
import ConversationSchema from '@/models/conversation.model';
import AttachmentSchema from '@/models/attachment.model';
import ImageAttachmentSchema from '@/models/images-attachment.model';
import MessageSchema from '@/models/message.model';
import { AuthRequest } from '@/types/auth-request';
import { Status } from '@/types/response';
import { successResponse, errorResponse } from '@/utils/response';
import { Types } from 'mongoose';
import { Response, NextFunction } from 'express';
import ws from '@/configs/ws';
import CustomWebSocket from '@/types/web-socket';
import ParticipantSchema from '@/models/participant.model';
import { storeFileToCloudinary, storeImgToCloudinary } from '@/utils/cloudinary';

class MessageController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const meId = req.payload?.userId;
            const { conversationId } = req.params;
            const { replyTo, content, isGroup } = req.body;
            const attachments = req.files as Express.Multer.File[]; // Cast to the correct type
            console.log('attachments', attachments);

            if (isGroup === null) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'isGroup field must be boolean type'),
                );
            }

            if (!meId) {
                res.status(Status.UNAUTHORIZED).json(errorResponse(Status.UNAUTHORIZED, 'User not authenticated'));
                return;
            }
            const meIdObjectId = new Types.ObjectId(meId);

            console.log('isGroup', isGroup);
            const isExistConversation = await ConversationSchema.findOne({ _id: conversationId, isGroup });

            if (!isExistConversation) {
                res.status(Status.BAD_REQUEST).json(errorResponse(Status.BAD_REQUEST, 'Conversation is not found'));
                return;
            }

            // if user is not in conversation
            const isParticipant = await ParticipantSchema.findOne({ user: meId, conversationId });

            if (!isParticipant) {
                res.status(Status.BAD_REQUEST).json(
                    errorResponse(Status.BAD_REQUEST, 'You are not member of this conversation'),
                );
                return;
            }

            let newImages = null;
            // if message has attachments
            const newAttachments = new Set();
            if (attachments && attachments.length > 0) {
                // get all image types
                const files = attachments.filter((attachment) => !attachment.mimetype.startsWith('image/'));
                const images = attachments.filter((attachment) => attachment.mimetype.startsWith('image/'));
                if (images.length > 0) {
                    const imageUrls = new Set();
                    // save image to cloud
                    for (const image of images) {
                        const stream = await storeImgToCloudinary(image, 'conversation-images');
                        const imageUrl = (stream as any).secure_url;
                        imageUrls.add({
                            url: imageUrl,
                            size: image.size,
                            name: image.originalname,
                        });
                    }

                    newImages = await ImageAttachmentSchema.create({
                        images: Array.from(imageUrls),
                        conversationId,
                        sender: meIdObjectId,
                    });
                }
                if (files.length > 0) {
                    console.log('SAVE FILE');
                    for (const file of files) {
                        const stream = await storeFileToCloudinary(file, 'conversation-files');
                        const fileUrl = (stream as any).secure_url;
                        const newAttachment = await AttachmentSchema.create({
                            url: fileUrl,
                            name: file.originalname,
                            type: 'file',
                            size: file.size,
                            conversationId,
                            sender: meIdObjectId,
                        });
                        newAttachments.add(newAttachment._id);
                    }
                }
            }

            const messageType = getMessageType({ content: !!content, attachments: attachments?.length > 0 });
            // create message in group conversation
            const newMessage = await MessageSchema.create({
                conversationId,
                sender: meIdObjectId,
                replyTo,
                content,
                messageType,
                attachments: Array.from(newAttachments),
                images: newImages,
            });

            isExistConversation.lastMessage = newMessage._id;
            await isExistConversation.save();
            const populatedMessage = await newMessage.populate([
                { path: 'sender', select: '_id fullName avatar username' },
                { path: 'attachments', select: 'url name type size' },
                { path: 'images', select: 'images' },
            ]);

            const participants = await ParticipantSchema.find({ conversationId }).select('user');
            const participantUserIds = new Set(participants.map((p) => p.user.toString()));

            // ws send message to all members in group
            const socket = ws.getWSS();
            if (socket) {
                socket.clients.forEach((client) => {
                    const customClient = client as CustomWebSocket;
                    if (
                        customClient.isAuthenticated &&
                        customClient.userId !== meId &&
                        participantUserIds.has(customClient.userId)
                    ) {
                        customClient.send(
                            JSON.stringify({
                                type: 'message',
                                data: {
                                    message: populatedMessage,
                                    conversationId,
                                },
                            }),
                        );
                    }
                });
            }

            res.status(Status.OK).json(successResponse(Status.OK, 'Create message successfully', populatedMessage));
            return;
        } catch (error) {
            console.log(error);
            next(error);
        }
    }

    async getMessageByConversationId(req: AuthRequest, res: Response, next: NextFunction) {
        const me = req.payload?.userId;

        // logic create message

        try {
            console.log('create message');
        } catch (error) {
            next(error);
        }
    }
}
export default new MessageController();
