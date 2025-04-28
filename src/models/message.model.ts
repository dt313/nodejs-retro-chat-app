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
        messageType: {
            type: String,
            enum: ['text', 'attachment', 'mixed'],
            required: true,
        },

        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },

        attachments: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Attachment',
        },
        reactions: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Reaction',
            default: [],
        },

        deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

const Message = mongoose.model('Message', MessageSchema);

export default Message;
