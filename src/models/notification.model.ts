import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: false,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        type: {
            type: String,
            enum: ['friend_request', 'friend_request_accepted', 'group_invitation', 'group_joined', 'message'],
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);

const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification;
