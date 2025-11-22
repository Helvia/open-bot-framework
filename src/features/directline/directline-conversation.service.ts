import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Activity, ConversationReference, Transcript } from 'botframework-schema';
import { DirectLineTokenPayload } from 'src/dto/directline.dto';
import { AuthorizationUtils } from '../authorization/authorization.utils';
import { ConfigService } from '@nestjs/config';
import { AuthorizationService } from '../authorization/authorization.service';
import { ConversationResponse } from 'src/dto/conversation.dto';
import { OpenBotService } from '../openbot/openbot.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { DirectLineGateway } from './directline.gateway';
import { DirectlineTokenService } from './dirtectline-token.service';

@Injectable()
export class DirectlineConversationService {
    private readonly expires: number;
    private readonly host: string;
    private readonly socketUrl: string;
    private readonly activityInc: Map<string, number>;
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly authorizationService: AuthorizationService,
        private readonly openBotService: OpenBotService,
        private readonly httpService: HttpService,
        private readonly socketGateway: DirectLineGateway,
        private readonly directLineTokenService: DirectlineTokenService
    ) {
        this.expires = Number(this.configService.get<number | string>('JWT_EXPIRATION_SECONDS')) || 3600;
        // Populate host from env/config
        this.host = String(this.configService.get<string>('DIRECTLINE_HOST') ?? '') || '';
        this.socketUrl = String(this.configService.get<string>('DIRECTLINE_SOCKET_URL') ?? '') || '';
        this.activityInc = new Map();
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
            const validPayload = this.directLineTokenService.verifyDirectLineToken(securityKey, false);
            const newPayload: DirectLineTokenPayload = {
                bot: validPayload.bot,
                site: validPayload.site,
                conv: validPayload.conv,
                user: convRef.user.id
            };
            const token = this.directLineTokenService.createToken(newPayload, this.expires);
            const conversationId = validPayload.conv;
            this.logger.verbose(`Created conversation ${conversationId}`);
            return {
                conversationId,
                expires_in: this.expires,
                token,
                streamUrl: this.generateStreamUrl(conversationId, token)
            };
        }

        // Secret provided
        if (dots === 1) {
            const tokenResponse = await this.directLineTokenService.generateToken(securityKey, convRef.user.id);
            const conversationId = tokenResponse.conversationId;
            const { token } = tokenResponse;
            return {
                ...tokenResponse,
                streamUrl: this.generateStreamUrl(conversationId, token)
            };
        }

        throw new UnauthorizedException();
    }

    // Secure? Must check
    getConversation(conversationId: string, authorizationHeader: string, watermark: string): ConversationResponse {
        const securityKey = AuthorizationUtils.removeBearer(authorizationHeader);
        if (!securityKey) {
            throw new BadRequestException('Wrong type of token provided. Provide Bearer');
        }
        this.directLineTokenService.verifyDirectLineToken(securityKey, false);
        this.activityInc.set(conversationId, Number(watermark));
        return {
            conversationId,
            expires_in: this.expires,
            token: securityKey,
            streamUrl: this.generateStreamUrl(conversationId, securityKey, watermark)
        };
    }

    async userReplyToConversation(
        conversationId: string,
        activity: Activity,
        authorizationHeader: string
    ): Promise<unknown> {
        const token = AuthorizationUtils.removeBearer(authorizationHeader);
        if (!token) {
            throw new BadRequestException('Wrong type of token provided. Provide Bearer');
        }
        // Validate signature
        const validPayload = this.directLineTokenService.verifyDirectLineToken(token, true);
        if (conversationId !== validPayload.conv) {
            throw new UnauthorizedException('Token does not belong to this conversation');
        }

        // Set bot recipient
        activity.recipient = { id: `${validPayload.bot}@${validPayload.site}`, name: validPayload.bot };
        const newActivity = this.createActivity(conversationId, activity);

        // Get bot for event endpoint
        const targetBot = await this.openBotService.findByHandleCached(validPayload.bot);

        // Push payload to event endpoint (needs queue)
        try {
            await lastValueFrom(
                this.httpService.post(targetBot.endpoint, newActivity, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000
                })
            );
            // Prepare the transcript and push to the live wire (does not require watermark)
            this.logger.verbose(`User sends type: ${newActivity.type}, text: ${newActivity.text}`);
            const transcript: Transcript = {
                activities: [activity]
            };
            this.socketGateway.sendToConversation(conversationId, transcript);
            return { id: newActivity.id };
        } catch (err) {
            throw new BadRequestException(`Failed to post to bot endpoint: ${err}`);
        }
    }

    replyToActivity(conversationId: string, activity: Activity, authorizationHeader: string, replyToActivity: string) {
        const token = AuthorizationUtils.removeBearer(authorizationHeader);
        if (!token) {
            throw new BadRequestException('Wrong type of token provided. Provide Bearer');
        }
        // Validate signature
        this.authorizationService.verifyAccessToken(token);

        // Reply is required when coming from bot
        activity.replyToId = replyToActivity;

        // Create the activity
        const newActivity = this.createActivity(conversationId, activity);

        // Prepare the transcript and push to the live wire (requires watermark)
        const transcript: Transcript & { watermark: string | undefined } = {
            activities: [activity],
            watermark: activity.type !== 'typing' ? String(this.activityInc.get(conversationId)) : undefined
        };
        this.logger.verbose(`Bot replies with type: ${newActivity.type}, text: ${newActivity.text}`);
        this.socketGateway.sendToConversation(conversationId, transcript);
        return { id: newActivity.id };
    }

    private createActivity(conversationId: string, activity: Activity) {
        // Logic is flawed. Microsoft increases activity id based on some other criterion
        if (activity.type !== 'typing') {
            if (this.activityInc.has(conversationId)) {
                const currentNumber = this.activityInc.get(conversationId)! + 1;
                this.activityInc.set(conversationId, currentNumber);
            } else {
                this.activityInc.set(conversationId, 0);
            }
            const counter = String(this.activityInc.get(conversationId));
            const padded = counter.padStart(7, '0');
            activity.id = `${conversationId}|${padded}`;
        } else {
            activity.id = `${conversationId}|${AuthorizationUtils.generateRandom(11)}`;
        }

        // Timestamp
        activity.timestamp = new Date();

        // Service url
        activity.serviceUrl = this.host;

        // Append Conversation
        activity.conversation = { id: conversationId, isGroup: false, conversationType: '', name: '' };

        return activity;
    }

    private countDots(token: string): number {
        let count = 0;
        for (let i = 0, len = token.length; i < len; i++) {
            if (token.charCodeAt(i) === 46) count++;
        }
        return count;
    }

    private generateStreamUrl(conversationId: string, token: string, watermark: string = '-'): string {
        return `${this.socketUrl}/v3/directline/conversations/${conversationId}/stream?watermark=${watermark}&t=${token}`;
    }
}
