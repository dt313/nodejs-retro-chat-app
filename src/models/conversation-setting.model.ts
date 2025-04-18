import mongoose from 'mongoose';

const ConversationSettingSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    isMute: { type: Boolean, default: false },
    isDelete: { type: Boolean, default: false },
    backgroundUrl: { type: String, default: null },
    nickname: { type: String, default: null },
});

const ConversationSetting = mongoose.model('ConversationSetting', ConversationSettingSchema);

export default ConversationSetting;
