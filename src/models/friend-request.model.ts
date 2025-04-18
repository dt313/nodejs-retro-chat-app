import mongoose from 'mongoose';

const FriendRequestSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending',
        },

        invitedAt: {
            type: Date,
            default: Date.now,
        },
        respondedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

FriendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });
const FriendRequest = mongoose.model('FriendRequest', FriendRequestSchema);

export default FriendRequest;
