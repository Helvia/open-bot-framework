import { Module } from '@nestjs/common';
import { DirectlineConversationService } from './directline-conversation.service';
import { DirectlineController } from './directline.controller';
import { WebChatModule } from '../channels/webchat/webchat.module';
import { WebChatService } from '../channels/webchat/webchat.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DirectLineGateway } from './directline.gateway';
import { HttpModule } from '@nestjs/axios';
import { DirectlineAltController } from './directline-alt.controller';
import { DirectlineTokenService } from './dirtectline-token.service';

@Module({
    imports: [WebChatModule, AuthorizationModule, HttpModule],
    providers: [DirectlineConversationService, WebChatService, DirectLineGateway, DirectlineTokenService],
    controllers: [DirectlineController, DirectlineAltController]
})
export class DirectlineModule {}
