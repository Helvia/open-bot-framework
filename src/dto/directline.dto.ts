import { JwtPayload } from 'jsonwebtoken';

export interface DirectLineTokenResponse {
    conversationId: string;
    token: string;
    expires_in?: number;
}

export type DirectLineTokenPayload = {
    bot: string;
    site: string;
    conv: string;
    user?: string;
} & JwtPayload;
