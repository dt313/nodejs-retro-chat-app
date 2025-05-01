import mongoose from 'mongoose';

const ReactionSchema = new mongoose.Schema(
    {
        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'messageType',
            required: true,
        },
        messageType: {
            type: String,
            enum: ['Message', 'Attachment', 'ImageAttachment'],
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['like', 'love', 'haha', 'sad', 'angry', 'wow', 'cry'],
            required: true,
        },
    },
    { timestamps: true },
);

ReactionSchema.index({ messageId: 1, user: 1 }, { unique: true });

const Reaction = mongoose.model('Reaction', ReactionSchema);

export default Reaction;
