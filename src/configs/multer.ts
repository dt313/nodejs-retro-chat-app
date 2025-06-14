import multer from 'multer';

const storage = multer.memoryStorage();

export const FILE_ACCEPT_LIST =
    '.jpg,.jpeg,.png,.txt,.csv,,.md,.js,.ts,.jsx,.tsx,.html,.css,.scss,.json,.xml,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.sh,.bat,.kt,.sql';

export const ACCEPTED_EXTENSIONS = FILE_ACCEPT_LIST.split(',').map((ext) => ext.trim().toLowerCase());

function attachmentFileFilter(req: any, file: any, cb: Function) {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('text/')) {
        cb(null, true);
    } else if (ACCEPTED_EXTENSIONS.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file hình ảnh và file text'), false);
    }
}

function conversationThumbnailFileFilter(req: any, file: any, cb: Function) {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file hình ảnh'), false);
    }
}

const attachmentsUpload = multer({ storage, fileFilter: attachmentFileFilter });

const conversationThumbnailUpload = multer({
    storage,
    fileFilter: conversationThumbnailFileFilter,
});

const userAvatarUpload = multer({
    storage,
    fileFilter: conversationThumbnailFileFilter,
});

export { attachmentsUpload, conversationThumbnailUpload, userAvatarUpload };
