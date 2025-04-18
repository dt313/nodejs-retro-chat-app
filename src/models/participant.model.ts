import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
        type: String,
        enum: ['creator', 'admin', 'member'],
        default: 'member',
    },
    jointAt: { type: Date, default: Date.now },
});

const Participant = mongoose.model('Participant', ParticipantSchema);

export default Participant;
