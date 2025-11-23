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

    /**
     * Upload an array of incoming files and attach resulting URLs to the provided activity attachments.
     *
     * @param files Array of UploadDto containing filename, buffer, mimetype etc.
     * @param conversationId Conversation id used to generate object keys
     * @param activity Activity object whose attachments will be updated with contentUrl
     * @throws HttpException when any individual upload fails
     */
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

    /**
     * Save a single file buffer to configured S3-compatible storage using AWS SDK v3 (lib-storage).
     * Calls the provided callback with the resulting location and original filename on success.
     *
     * @param file UploadDto containing filename, buffer and mimetype
     * @param conversationId Conversation identifier to include in object key path
     * @param callback Function invoked with { location, filename } after successful upload
     * @returns Promise<void> resolves when upload completes or rejects on failure
     */
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

    /**
     * Generate an object key for storage using conversation id, sanitized filename and a random suffix.
     * Ensures filename uniqueness and avoids spaces.
     *
     * @param filename Original file name (may be empty)
     * @param conversationId Conversation id to prefix the key
     * @returns string object key to use for storage (e.g. "<conv>/attachments/<name>-<id>.<ext>")
     */
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

    /**
     * Create and return an S3Client configured from env vars.
     * Uses endpoint, credentials and region from configuration.
     *
     * @returns S3Client instance configured for the target storage backend
     */
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
