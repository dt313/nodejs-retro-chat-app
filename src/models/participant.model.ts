import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    role: {
        type: String,
        enum: ['creator', 'admin', 'member'],
        default: 'member',
    },
    jointAt: { type: Date, default: Date.now },
});

ParticipantSchema.index({ conversationId: 1, user: 1 }, { unique: true });
const Participant = mongoose.model('Participant', ParticipantSchema);

export default Participant;
