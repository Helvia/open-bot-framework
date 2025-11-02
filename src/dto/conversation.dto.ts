import { DirectLineTokenResponse } from './directline.dto';

export interface ConversationResponse extends DirectLineTokenResponse {
    streamUrl: string;
}

export class ChannelPayload {
    user: { id: string };
}
