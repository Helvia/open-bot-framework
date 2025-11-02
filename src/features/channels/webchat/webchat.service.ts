import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WebChatChannelDto } from 'src/dto/webchat.dto';
import { WebChatChannel } from 'src/entities/webchat.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { OpenBotService } from '../../openbot/openbot.service';
import { PaginatedTransform } from 'src/dto/page.dto';
import { AuthorizationUtils } from 'src/features/authorization/authorization.utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class WebChatService {
    constructor(
        private readonly openBotService: OpenBotService,
        @InjectRepository(WebChatChannel)
        private readonly webchatRepository: Repository<WebChatChannel>,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
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

    // Do not expose to controller
    async findById(id: string, relations?: string[]): Promise<WebChatChannel | null> {
        return this.webchatRepository.findOne({ relations, where: { id } });
    }

    async findByIdCached(id: string, relations?: string[]): Promise<WebChatChannel | null> {
        const key = `webchat:${id}:${(relations ?? []).join(',')}`;
        return this.cacheManager.wrap(key, () => this.findById(id, relations), 10);
    }

    async existsById(id: string): Promise<boolean> {
        return this.webchatRepository.exists({ where: { id } });
    }

    async existsByIdCached(id: string): Promise<boolean> {
        return this.cacheManager.wrap(id, () => this.webchatRepository.exists({ where: { id } }), 10);
    }

    async findByIdInBot(botId: string, id: string): Promise<WebChatChannel> {
        const openBot = await this.openBotService.findById(botId);
        const channel = await this.webchatRepository.findOne({ where: { id, openBot: { id: openBot.id } } });
        if (channel) return channel;
        throw new NotFoundException();
    }

    async createBotSecret(botId: string, payload: WebChatChannelDto): Promise<WebChatChannelDto> {
        const openBot = await this.openBotService.findById(botId);
        const channel = new WebChatChannel();
        channel.id = AuthorizationUtils.generateRandom(11);
        channel.openBot = openBot;
        channel.name = payload.name;
        channel.secret1 = AuthorizationUtils.createWebChatSecret(channel.id);
        channel.secret2 = AuthorizationUtils.createWebChatSecret(channel.id);
        const saved = await this.webchatRepository.save(channel);
        return saved.toDto();
    }

    async update(botId: string, id: string, payload: Partial<WebChatChannelDto>): Promise<WebChatChannelDto> {
        const channel = await this.findByIdInBot(botId, id);
        channel.name = payload.name ?? channel.name;
        channel.secret1 =
            payload.secret1 === null ? AuthorizationUtils.createWebChatSecret(channel.id) : channel.secret1;
        channel.secret2 =
            payload.secret2 === null ? AuthorizationUtils.createWebChatSecret(channel.id) : channel.secret2;
        const saved = await this.webchatRepository.save(channel);
        return saved.toDto();
    }

    async delete(botId: string, id: string): Promise<void> {
        const channel = await this.findByIdInBot(botId, id);
        await this.webchatRepository.delete({ id: channel.id });
    }
}
