import mongoose from 'mongoose';
import ReactionSchema from './reaction.model';

const AttachmentSchema = new mongoose.Schema({
    url: { type: String, required: true, require: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['image', 'file'], required: true },
    size: { type: Number, required: true },
});

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
            enum: ['text', 'file', 'text-file'],
            required: true,
        },

        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],

        attachments: [{ type: AttachmentSchema, default: [] }],
        reactions: [{ type: ReactionSchema, default: [] }],

        deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

const Message = mongoose.model('Message', MessageSchema);

export default Message;
