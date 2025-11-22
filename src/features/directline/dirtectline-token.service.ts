import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DirectLineTokenPayload, DirectLineTokenResponse } from 'src/dto/directline.dto';
import { AuthorizationUtils } from '../authorization/authorization.utils';
import { WebChatService } from '../channels/webchat/webchat.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class DirectlineTokenService {
    private readonly expires: number;
    private readonly region: string;
    private readonly directLineHost: string;

    constructor(
        private readonly webChatService: WebChatService,
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService
    ) {
        this.expires = Number(this.configService.get<number | string>('JWT_EXPIRATION_SECONDS')) || 3600;
        // Populate host and region from env/config
        this.region = String(this.configService.get<string>('DIRECTLINE_REGION') ?? '') || '';
        this.directLineHost = String(this.configService.get<string>('DIRECTLINE_HOST') ?? '') || '';
    }

    createToken(payload: DirectLineTokenPayload, expiration: number): string {
        const now = Math.floor(Date.now() / 1000);
        const claims = {
            ...payload,
            iss: `https://${this.directLineHost}/`,
            aud: `https://${this.directLineHost}/`,
            nbf: now,
            exp: now + expiration
        };
        return this.jwtService.sign(claims);
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
            token: this.createToken(tokenPayload, this.expires)
        };
    }

    async refreshToken(authorizationHeader: string): Promise<DirectLineTokenResponse> {
        const token = AuthorizationUtils.removeBearer(authorizationHeader);
        if (!token) {
            throw new BadRequestException('Wrong type of token provided. Provide Bearer');
        }
        // Validate signature
        const validPayload = this.verifyDirectLineToken(token, true);

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
            token: this.createToken(newPayload, this.expires)
        };
    }

    verifyDirectLineToken(token: string, ignoreExpiration: boolean): DirectLineTokenPayload {
        try {
            return this.jwtService.verify<DirectLineTokenPayload>(token, { ignoreExpiration });
        } catch (e: unknown) {
            throw new UnauthorizedException(`Invalid token. ${String(e)}`);
        }
    }
}
