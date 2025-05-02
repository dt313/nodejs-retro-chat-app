import LastMessageType from '@/types/last-message-type';

const getMessageType = ({
    content,
    file,
    image,
}: {
    content: boolean;
    file: boolean;
    image: boolean;
}): LastMessageType => {
    // ['text', 'text-file', 'image', 'text-image', 'file'],
    if (content && file && image) {
        return 'text-image-file';
    } else if (content && file) {
        return 'text-file';
    } else if (content && image) {
        return 'text-image';
    } else if (file && image) {
        return 'file-image';
    } else if (file) {
        return 'file';
    } else if (image) {
        return 'image';
    } else if (content) {
        return 'text';
    } else {
        return 'text';
    }
};

export default getMessageType;
