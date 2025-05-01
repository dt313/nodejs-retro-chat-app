import MessageSchema from '@/models/message.model';
import AttachmentSchema from '@/models/attachment.model';
import ImageAttachmentSchema from '@/models/images-attachment.model';

export const reactionModelMap: Record<
    string,
    typeof MessageSchema | typeof AttachmentSchema | typeof ImageAttachmentSchema
> = {
    Message: MessageSchema,
    Attachment: AttachmentSchema,
    ImageAttachment: ImageAttachmentSchema,
};

export type ReactionMessageType = keyof typeof reactionModelMap;
