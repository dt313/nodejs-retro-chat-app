import cloudinary from '@/configs/cloudinary';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function storeImgToCloudinary(file: Express.Multer.File, folderName: string) {
    const stream = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader
            .upload_stream(
                {
                    folder: folderName,
                    public_id: uuidv4(),
                    use_filename: true,
                    unique_filename: true,
                    resource_type: 'image',
                    overwrite: false,
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                },
            )
            .end(file.buffer);
    });

    return stream;
}

export async function storeFileToCloudinary(file: Express.Multer.File, folderName: string) {
    const ext = path.extname(file.originalname); // .png
    const uniqueFileName = uuidv4() + ext;

    const stream = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader
            .upload_stream(
                {
                    folder: folderName,
                    public_id: uniqueFileName,
                    resource_type: 'raw',
                    use_filename: true,
                    unique_filename: true,
                    overwrite: false,
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                },
            )
            .end(file.buffer);
    });

    return stream;
}

export async function storeVideoToCloudinary(file: Express.Multer.File, folderName: string) {
    const ext = path.extname(file.originalname); // .png

    const uniqueFileName = uuidv4() + ext;
    const stream = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader
            .upload_stream(
                {
                    folder: folderName,
                    public_id: uniqueFileName,
                    resource_type: 'video',
                    use_filename: true,
                    unique_filename: true,
                    overwrite: false,
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                },
            )
            .end(file.buffer);
    });

    return stream;
}
