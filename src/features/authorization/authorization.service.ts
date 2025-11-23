import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OpenBotSecretService } from '../openbotsecret/openbotsecret.service';
import { AccessTokenResponseDto } from 'src/dto/token.dto';

@Injectable()
export class AuthorizationService {
    private readonly directLineHost: string;

    constructor(
        private readonly jwtService: JwtService,
        private readonly openBotSecretService: OpenBotSecretService
    ) {}

    /**
     * Verify an access token (server-to-server) and return decoded payload.
     *
     * @param token JWT string to verify
     * @returns AccessTokenResponseDto decoded token payload
     * @throws UnauthorizedException when verification fails
     */
    verifyAccessToken(token: string): AccessTokenResponseDto {
        try {
            return this.jwtService.verify<AccessTokenResponseDto>(token);
        } catch (e: unknown) {
            throw new UnauthorizedException(`Invalid token. ${String(e)}`);
        }
    }

    /**
     * Generate an access token for a client given its id and secret.
     * Validates credentials via OpenBotSecretService.
     *
     * @param clientId Client identifier (open bot secret id)
     * @param clientSecret Client secret plain text
     * @param scope Optional scope/audience to embed in the token
     * @returns AccessTokenResponseDto containing token_type, expires_in and access_token
     * @throws UnauthorizedException if credentials invalid
     */
    async generateAccessToken(clientId: string, clientSecret: string, scope?: string): Promise<AccessTokenResponseDto> {
        // Validate against bot credentials
        await this.openBotSecretService.validateSecretCached(clientId, clientSecret);

        // Typical MS behavior: 1 hour expiry
        const expiresInSeconds = 3600;

        const tokenPayload = {
            aud: scope || 'https://api.botframework.com/.default',
            iss: this.directLineHost,
            sub: clientId
        };

        // Sign JWT with your secret key (HMAC 256)
        const accessToken = this.jwtService.sign(tokenPayload, {
            algorithm: 'HS256',
            expiresIn: expiresInSeconds
        });

        return {
            token_type: 'Bearer',
            expires_in: expiresInSeconds,
            access_token: accessToken
        };
    }
}
