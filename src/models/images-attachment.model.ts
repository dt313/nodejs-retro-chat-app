import mongoose from 'mongoose';

const ImageAttachmentSchema = new mongoose.Schema({
    images: [
        {
            url: { type: String, required: true },
            name: { type: String, required: true },
            size: { type: Number, required: true },
        },
    ],
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
    isDeleted: {
        type: Boolean,
        default: false,
    },
});

const ImageAttachment = mongoose.model('ImageAttachment', ImageAttachmentSchema);

export default ImageAttachment;
