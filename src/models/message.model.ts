import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
        },
        mentionedUsers: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'User',
            default: [],
        },
        messageType: {
            type: String,
            enum: [
                'text',
                'text-file',
                'image',
                'text-image',
                'file',
                'text-image-file',
                'file-image',
                'notification',
                'call-missed',
                'call-ended',
                'video-call-missed',
                'video-call-ended',
            ],
            required: true,
        },

        attachments: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Attachment',
            default: [],
        },

        images: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ImageAttachment',
            default: null,
        },
        reactions: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Reaction',
            default: [],
        },

        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'replyType',
            default: null,
        },
        replyType: {
            type: String,
            enum: ['Message', 'Attachment', 'ImageAttachment'],
        },

        isForwarded: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

const Message = mongoose.model('Message', MessageSchema);

export default Message;
