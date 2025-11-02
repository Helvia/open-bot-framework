import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DirectLineTokenPayload } from 'src/dto/directline.dto';

@Injectable()
export class AuthorizationService {
    private readonly directLineHost: string;

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
    ) {
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

    verifyToken(token: string, ignoreExpiration: boolean): DirectLineTokenPayload {
        try {
            return this.jwtService.verify<DirectLineTokenPayload>(token, { ignoreExpiration });
        } catch (e: unknown) {
            throw new UnauthorizedException(`Invalid token. ${String(e)}`);
        }
    }
}
