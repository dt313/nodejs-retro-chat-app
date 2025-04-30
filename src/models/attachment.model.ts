import mongoose from 'mongoose';

const AttachmentSchema = new mongoose.Schema({
    url: { type: String, required: true, require: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['file'], required: true },
    size: { type: Number, required: true },
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
});

const Attachment = mongoose.model('Attachment', AttachmentSchema);

export default Attachment;
