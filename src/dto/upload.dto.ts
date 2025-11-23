export interface UploadDto {
    filename: string;
    mimetype: string;
    fieldname: string;
    buffer: Buffer<ArrayBufferLike>;
}
