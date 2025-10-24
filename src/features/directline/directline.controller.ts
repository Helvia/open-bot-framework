import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ChannelAccount } from 'botframework-schema';

@Controller('v3/directline')
export class DirectlineController {
    @Post('conversation')
    createConversation(@Body() user: ChannelAccount, @Headers('authorization') token: string) {}
}
