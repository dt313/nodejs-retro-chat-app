import mongoose from 'mongoose';
import ParticipantSchema from './participant.model';

const ConversationSchema = new mongoose.Schema(
    {
        isGroup: { type: Boolean, default: false },
        name: { type: String, default: null },
        avatar: { type: String, default: null },
        description: { type: String, default: null },
        rules: { type: String, default: null },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        deleteBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],

        participants: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Participant',
            required: true,
        },

        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },
        pinnedMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },

        type: {
            type: String,
            default: null,
        },

        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true },
);

const Conversation = mongoose.model('Conversation', ConversationSchema);

export default Conversation;
