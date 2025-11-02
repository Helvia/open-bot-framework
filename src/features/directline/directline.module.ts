import { Module } from '@nestjs/common';
import { DirectlineService } from './directline.service';
import { DirectlineController } from './directline.controller';
import { WebChatModule } from '../channels/webchat/webchat.module';
import { WebChatService } from '../channels/webchat/webchat.service';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
    imports: [WebChatModule, AuthorizationModule],
    providers: [DirectlineService, WebChatService],
    controllers: [DirectlineController]
})
export class DirectlineModule {}
