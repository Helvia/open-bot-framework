import { Body, Controller, Headers, Param, Post, HttpCode, Get, Query } from '@nestjs/common';
import { Activity, ConversationReference } from 'botframework-schema';
import { DirectLineTokenResponse } from 'src/dto/directline.dto';
import { DirectlineConversationService } from './directline-conversation.service';
import { ConversationResponse } from 'src/dto/conversation.dto';
import { DirectlineTokenService } from './dirtectline-token.service';

@Controller('v3/directline')
export class DirectlineController {
    constructor(
        private readonly directLineService: DirectlineConversationService,
        private readonly directLineTokenService: DirectlineTokenService
    ) {}
    @Post('tokens/generate')
    @HttpCode(200)
    generateToken(@Headers('authorization') webChatSecret: string): Promise<DirectLineTokenResponse> {
        return this.directLineTokenService.generateToken(webChatSecret);
    }

    @Post('tokens/refresh')
    @HttpCode(200)
    refreshToken(@Headers('authorization') webChatSecret: string): Promise<DirectLineTokenResponse> {
        return this.directLineTokenService.refreshToken(webChatSecret);
    }

    @Post('conversations')
    createConversation(
        @Body() convRef: ConversationReference,
        @Headers('authorization') securityKey: string
    ): Promise<ConversationResponse> {
        return this.directLineService.createConversation(convRef, securityKey);
    }

    @Get('conversations/:convId')
    getConversation(
        @Param('convId') convId: string,
        @Headers('authorization') securityKey: string,
        @Query('watermark') watermark: string
    ): ConversationResponse {
        return this.directLineService.getConversation(convId, securityKey, watermark);
    }

    @Post('conversations/:convId/activities')
    @HttpCode(200)
    createActivity(
        @Param('convId') convId: string,
        @Body() activity: Activity,
        @Headers('authorization') securityKey: string
    ): Promise<unknown> {
        return this.directLineService.userReplyToConversation(convId, activity, securityKey);
    }
}
