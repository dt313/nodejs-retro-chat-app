import cloudinary from '@/configs/cloudinary';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
export async function storeImgToCloudinary(file: Express.Multer.File, folderName: string) {
    const originalName = path.basename(file.originalname, path.extname(file.originalname));
    const ext = path.extname(file.originalname);
    const uniqueFileName = `${originalName}_${uuidv4()}${ext}`;

    const stream = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader
            .upload_stream(
                {
                    folder: folderName,
                    public_id: uniqueFileName,
                    resource_type: 'image',
                    use_filename: false,
                    unique_filename: false,
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
    const originalName = path.basename(file.originalname, path.extname(file.originalname));
    const ext = path.extname(file.originalname);
    const uniqueFileName = `${originalName}_${uuidv4()}${ext}`;

    const stream = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader
            .upload_stream(
                {
                    folder: folderName,
                    public_id: uniqueFileName,
                    resource_type: 'raw',
                    use_filename: false,
                    unique_filename: false,
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
