type LastMessageType =
    | 'text'
    | 'file'
    | 'image'
    | 'text-file'
    | 'file-image'
    | 'text-image'
    | 'text-image-file'
    | 'reaction'
    | 'delete'
    | 'null';

export default LastMessageType;
