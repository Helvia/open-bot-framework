import { IsString, IsNotEmpty, IsEmpty } from 'class-validator';

export class WebChatChannelDto {
    @IsEmpty()
    id?: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEmpty()
    createdAt?: Date;
    secret1?: string;
    secret2?: string;
}
