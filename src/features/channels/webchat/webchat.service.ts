import { Injectable, NotFoundException } from '@nestjs/common';
import { WebChatChannelDto } from 'src/dto/webchat.dto';
import { WebChatChannel } from 'src/entities/webchat.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { OpenBotService } from '../../openbot/openbot.service';
import { PaginatedTransform } from 'src/dto/page.dto';
import { AuthorizationUtils } from 'src/features/authorization/authorization.utils';

@Injectable()
export class WebChatService {
    constructor(
        private readonly openBotService: OpenBotService,
        @InjectRepository(WebChatChannel)
        private readonly webchatRepository: Repository<WebChatChannel>
    ) {}

    async findAll(
        botId: string,
        page: number,
        pageSize: number
    ): Promise<PaginatedTransform<WebChatChannel, WebChatChannelDto>> {
        let selectSkip: FindManyOptions<WebChatChannel> = {};
        const openBot = await this.openBotService.findById(botId);
        if (!isNaN(page) && !isNaN(pageSize)) {
            selectSkip = {
                where: {
                    openBot: { id: openBot.id }
                },
                take: pageSize,
                skip: page * pageSize
            } as FindManyOptions<WebChatChannel>;
        }
        return new PaginatedTransform(await this.webchatRepository.findAndCount(selectSkip), page, pageSize, d =>
            d.toDto()
        );
    }

    async findById(botId: string, id: string): Promise<WebChatChannel> {
        const openBot = await this.openBotService.findById(botId);
        const channel = await this.webchatRepository.findOne({ where: { id, openBot: { id: openBot.id } } });
        if (channel) return channel;
        throw new NotFoundException();
    }

    async createBotSecret(botId: string, payload: WebChatChannelDto): Promise<WebChatChannelDto> {
        const openBot = await this.openBotService.findById(botId);
        const channel = new WebChatChannel();
        channel.openBot = openBot;
        channel.name = payload.name;
        channel.secret1 = AuthorizationUtils.generateRandom(55);
        channel.secret2 = AuthorizationUtils.generateRandom(55);
        const saved = await this.webchatRepository.save(channel);
        return saved.toDto();
    }

    async update(botId: string, id: string, payload: Partial<WebChatChannelDto>): Promise<WebChatChannelDto> {
        const channel = await this.findById(botId, id);
        channel.name = payload.name ?? channel.name;
        channel.secret1 = payload.secret1 === null ? AuthorizationUtils.generateRandom(55) : channel.secret1;
        channel.secret2 = payload.secret2 === null ? AuthorizationUtils.generateRandom(55) : channel.secret2;
        const saved = await this.webchatRepository.save(channel);
        return saved.toDto();
    }

    async delete(botId: string, id: string): Promise<void> {
        const channel = await this.findById(botId, id);
        await this.webchatRepository.delete({ id: channel.id });
    }
}
