const getMessageType = ({ content, attachments }: { content: boolean; attachments: boolean }): string => {
    if (content && attachments) {
        return 'mixed';
    }
    if (attachments) {
        return 'attachment';
    }
    return 'text';
};

export default getMessageType;
