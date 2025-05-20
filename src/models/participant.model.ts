import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    nickname: { type: String, default: '' },
    role: {
        type: String,
        enum: ['creator', 'admin', 'member'],
        default: 'member',
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },
    lastMessageReadAt: {
        type: Date,
        default: null,
    },
    jointAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null, required: false },
});

ParticipantSchema.index({ conversationId: 1, user: 1 }, { unique: true });
const Participant = mongoose.model('Participant', ParticipantSchema);

export default Participant;
