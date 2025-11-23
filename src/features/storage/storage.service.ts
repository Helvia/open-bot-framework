/*
https://docs.nestjs.com/providers#services
*/

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import { Activity } from 'botframework-schema';
import * as crypto from 'crypto';
import { UploadDto } from 'src/dto/upload.dto';

@Injectable()
export class StorageService {
    private storageBucket: string;
    private storageHandle: S3Client;

    constructor(private configService: ConfigService) {
        this.storageBucket = this.configService.get('STORAGE_BUCKET') || '';
        this.storageHandle = this.getStorageHandle();
    }

    async uploadToActivity(files: UploadDto[], conversationId: string, activity: Activity) {
        for (const file of files) {
            try {
                await this.save(file, conversationId, response => {
                    const attachment = activity.attachments?.find(a => a.name === response.filename);
                    if (attachment) {
                        attachment.contentUrl = response.location;
                    }
                });
            } catch (e: unknown) {
                throw new HttpException(
                    `Could not upload an incoming file: ${file.filename}: ${String(e)}`,
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
        }
    }

    async save(
        file: UploadDto,
        conversationId: string,
        callback: (response: { location: string; filename: string }) => void
    ): Promise<void> {
        const { filename, buffer, mimetype } = file;
        const Key = this.generateObjectKey(filename, conversationId);
        const parallelUploads3 = new Upload({
            client: this.storageHandle,
            params: {
                Bucket: this.storageBucket,
                Key,
                Body: buffer,
                ContentType: mimetype
            }
        });

        // 2. Execute the upload
        const result = await parallelUploads3.done();

        // 3. Use the Location returned directly from S3
        if (result.Location) {
            callback({ location: result.Location, filename });
        } else {
            throw new Error('S3 did not return a location.');
        }
    }

    private generateObjectKey(filename: string, conversationId: string): string {
        const id = crypto.randomBytes(8).toString('hex');
        if (filename === '') {
            filename = id;
        } else {
            filename = filename.replaceAll(' ', '_');
            const splitFilename = filename.split(/\.([^.]*)$/);
            filename = `${splitFilename[0]}-${id}`;
            filename += splitFilename[1] ? `.${splitFilename[1]}` : '';
        }
        return `${conversationId}/attachments/${filename}`;
    }

    private getStorageHandle(): S3Client {
        return new S3Client({
            endpoint: String(this.configService.get('STORAGE_ENDPOINT') || '') || undefined,
            credentials: {
                accessKeyId: String(this.configService.get('STORAGE_ACCESS_KEY') || ''),
                secretAccessKey: String(this.configService.get('STORAGE_SECRET_KEY') || '')
            },
            region: String(this.configService.get('STORAGE_REGION_S3') || ''),
            forcePathStyle: Boolean(this.configService.get('STORAGE_FORCE_S3_PATH_STYLE') || false)
        });
    }
}
