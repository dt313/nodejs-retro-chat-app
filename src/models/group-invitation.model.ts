import mongoose from 'mongoose';

const GroupInvitationSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        invitedTo: {
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

GroupInvitationSchema.index({ conversationId: 1, invitedBy: 1, invitedTo: 1 }, { unique: true });

const GroupInvitation = mongoose.model('GroupInvitation', GroupInvitationSchema);

export default GroupInvitation;
