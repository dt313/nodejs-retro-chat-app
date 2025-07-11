import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema(
    {
        isGroup: { type: Boolean, default: false },
        name: { type: String, default: null, maxLength: 100 },
        thumbnail: { type: String, default: null },
        theme: { type: String, default: null },
        description: { type: String, default: null },
        rules: { type: String, default: null },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        participants: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Participant',
            default: [],
        },

        lastMessage: {
            content: { type: String, default: '' },
            type: {
                type: String,
                enum: [
                    'text',
                    'file',
                    'image',
                    'file-image',
                    'text-file',
                    'text-image',
                    'text-image-file',
                    'reaction',
                    'call-missed',
                    'call-ended',
                    'video-call-missed',
                    'video-call-ended',
                    'delete',
                    'null',
                ],
                default: 'null',
            },
            sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            readedBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
            sentAt: { type: Date, default: Date.now },
        },

        pinnedMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
            required: false,
        },

        isPrivate: {
            type: Boolean,
            default: false,
        },

        password: {
            type: String,
            default: null,
        },

        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true },
);

const Conversation = mongoose.model('Conversation', ConversationSchema);

export default Conversation;
