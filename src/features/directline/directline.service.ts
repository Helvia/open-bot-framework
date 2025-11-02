import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConversationReference } from 'botframework-schema';
import { DirectLineTokenPayload, DirectLineTokenResponse } from 'src/dto/directline.dto';
import { AuthorizationUtils } from '../authorization/authorization.utils';
import { WebChatService } from '../channels/webchat/webchat.service';
import { ConfigService } from '@nestjs/config';
import { AuthorizationService } from '../authorization/authorization.service';
import { ConversationResponse } from 'src/dto/conversation.dto';

@Injectable()
export class DirectlineService {
    private readonly expires: number;
    private readonly host: string;
    private readonly region: string;

    constructor(
        private readonly webChatService: WebChatService,
        private readonly configService: ConfigService,
        private readonly authorizationService: AuthorizationService
    ) {
        this.expires = Number(this.configService.get<number | string>('JWT_EXPIRATION_SECONDS')) || 3600;
        // Populate host and region from env/config
        this.host = String(this.configService.get<string>('DIRECTLINE_HOST') ?? '') || '';
        this.region = String(this.configService.get<string>('DIRECTLINE_REGION') ?? '') || '';
    }

    async generateToken(authorizationHeader: string, user?: string): Promise<DirectLineTokenResponse> {
        const secret = AuthorizationUtils.removeBearer(authorizationHeader);
        if (!secret) {
            throw new BadRequestException('Wrong type of secret provided. Provide Bearer');
        }
        // webChatSecret length
        const secretSplit = secret.split('.');
        const siteId = secretSplit[0];
        const hmac = secretSplit[1];
        if (!siteId || !hmac) {
            // TODO: Check alnum for both, and check base64 decode validity for hmac
            throw new BadRequestException('Wrong secret format');
        }
        // Find webchat site
        const webChatSite = await this.webChatService.findByIdCached(siteId, ['openBot']);
        if (!webChatSite) {
            throw new UnauthorizedException();
        }
        // Prepare creating the payload
        const conversationId = `${AuthorizationUtils.createSecret(12)}-${this.region}`;
        const tokenPayload = {
            bot: webChatSite.openBot.handle,
            site: siteId,
            conv: conversationId,
            user
        };
        return {
            conversationId,
            expires_in: this.expires,
            token: this.authorizationService.createToken(tokenPayload, this.expires)
        };
    }

    async refreshToken(authorizationHeader: string): Promise<DirectLineTokenResponse> {
        const token = AuthorizationUtils.removeBearer(authorizationHeader);
        if (!token) {
            throw new BadRequestException('Wrong type of token provided. Provide Bearer');
        }
        // Validate signature
        const validPayload = this.authorizationService.verifyToken(token, true);

        // Validate site exists
        const webChatSite = await this.webChatService.existsByIdCached(validPayload.site);
        if (!webChatSite) {
            throw new UnauthorizedException();
        }
        // Re-produce token
        const newPayload: DirectLineTokenPayload = {
            bot: validPayload.bot,
            site: validPayload.site,
            conv: validPayload.conv,
            user: validPayload.user
        };

        return {
            conversationId: validPayload.conv,
            expires_in: this.expires,
            token: this.authorizationService.createToken(newPayload, this.expires)
        };
    }

    async createConversation(
        convRef: ConversationReference,
        authorizationHeader: string
    ): Promise<ConversationResponse> {
        const securityKey = AuthorizationUtils.removeBearer(authorizationHeader);
        if (!securityKey) {
            throw new BadRequestException('Wrong type of token provided. Provide Bearer');
        }
        if (!convRef.user?.id) {
            throw new BadRequestException('No user provided');
        }

        // Identify type of security key
        const dots = this.countDots(securityKey);
        // JWT token (need to avoid the costly verify method)
        if (dots === 2) {
            const validPayload = this.authorizationService.verifyToken(securityKey, false);
            const newPayload: DirectLineTokenPayload = {
                bot: validPayload.bot,
                site: validPayload.site,
                conv: validPayload.conv,
                user: convRef.user.id
            };
            const token = this.authorizationService.createToken(newPayload, this.expires);
            const conversationId = validPayload.conv;
            return {
                conversationId,
                expires_in: this.expires,
                token,
                streamUrl: this.generateStreamUrl(conversationId, token)
            };
        }

        // Secret provided
        if (dots === 1) {
            const tokenResponse = await this.generateToken(securityKey, convRef.user.id);
            const conversationId = tokenResponse.conversationId;
            const { token } = tokenResponse;
            return {
                ...tokenResponse,
                streamUrl: this.generateStreamUrl(conversationId, token)
            };
        }

        throw new UnauthorizedException();
    }

    countDots(token: string): number {
        let count = 0;
        for (let i = 0, len = token.length; i < len; i++) {
            if (token.charCodeAt(i) === 46) count++;
        }
        return count;
    }

    generateStreamUrl(conversationId: string, token: string): string {
        return `wss://${this.host}/v3/directline/conversations/${conversationId}&watermark=-&t=${token}`;
    }
}
