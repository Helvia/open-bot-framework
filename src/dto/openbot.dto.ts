import { IsString, IsNotEmpty } from 'class-validator';

export class OpenBotDto {
    id?: string;
    appId: string;
    @IsString()
    @IsNotEmpty()
    endpoint: string;
    schemaVersion: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export class OpenBotSecretDto {
    secretId?: string;
    @IsString()
    @IsNotEmpty()
    description: string;
    createdAt?: Date;
    expiresAt?: Date;
    secret?: string;
}
