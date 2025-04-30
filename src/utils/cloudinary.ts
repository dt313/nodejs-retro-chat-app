import cloudinary from '@/configs/cloudinary';

export async function storeImgToCloudinary(file: Express.Multer.File, folderName: string) {
    const stream = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader
            .upload_stream(
                {
                    folder: folderName,
                    resource_type: 'image',
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
    const stream = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader
            .upload_stream(
                {
                    folder: folderName,
                    resource_type: 'raw',
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
