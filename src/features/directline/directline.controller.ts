import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ConversationReference } from 'botframework-schema';
import { DirectLineTokenResponse } from 'src/dto/directline.dto';
import { DirectlineService } from './directline.service';
import { ConversationResponse } from 'src/dto/conversation.dto';

@Controller('v3/directline')
export class DirectlineController {
    constructor(private readonly directLineService: DirectlineService) {}
    @Post('token/generate')
    generateToken(@Headers('authorization') webChatSecret: string): Promise<DirectLineTokenResponse> {
        return this.directLineService.generateToken(webChatSecret);
    }

    @Post('token/refresh')
    refreshToken(@Headers('authorization') webChatSecret: string): Promise<DirectLineTokenResponse> {
        return this.directLineService.refreshToken(webChatSecret);
    }

    @Post('conversations')
    createConversation(
        @Body() convRef: ConversationReference,
        @Headers('authorization') securityKey: string
    ): Promise<ConversationResponse> {
        return this.directLineService.createConversation(convRef, securityKey);
    }
}
