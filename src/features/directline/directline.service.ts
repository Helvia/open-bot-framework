import { Injectable } from '@nestjs/common';
import { ChannelAccount } from 'botframework-schema';

@Injectable()
export class DirectlineService {
    createConversation(user: ChannelAccount) {}
}
