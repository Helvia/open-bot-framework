import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { OpenBotSecretDto } from 'src/dto/openbot.dto';
import { OpenBotSecret } from 'src/entities/openbot.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { OpenBotService } from '../openbot/openbot.service';
import { PaginatedTransform } from 'src/dto/page.dto';
import { AuthorizationUtils } from '../authorization/authorization.utils';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class OpenBotSecretService {
    constructor(
        private readonly openBotService: OpenBotService,
        @InjectRepository(OpenBotSecret)
        private readonly openBotSecretRepository: Repository<OpenBotSecret>,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache
    ) {}

    async findAll(
        botId: string,
        page: number,
        pageSize: number
    ): Promise<PaginatedTransform<OpenBotSecret, OpenBotSecretDto>> {
        let selectSkip: FindManyOptions<OpenBotSecret> = {};
        const openBot = await this.openBotService.findById(botId);
        if (!isNaN(page) && !isNaN(pageSize)) {
            selectSkip = {
                where: {
                    openBot: { id: openBot.id }
                },
                take: pageSize,
                skip: page * pageSize
            } as FindManyOptions<OpenBotSecret>;
        }
        return new PaginatedTransform(await this.openBotSecretRepository.findAndCount(selectSkip), page, pageSize, d =>
            d.toDto()
        );
    }

    async findByIdInOpenBot(botId: string, id: string): Promise<OpenBotSecret> {
        const openBot = await this.openBotService.findById(botId);
        // query by secret id and the related openBot id
        const secret = await this.openBotSecretRepository.findOne({ where: { id, openBot: { id: openBot.id } } });
        if (secret) return secret;
        throw new NotFoundException();
    }

    // Never expose in controller
    async findById(id: string): Promise<OpenBotSecret> {
        return this.cacheManager.wrap(
            id,
            async () => {
                const secret = await this.openBotSecretRepository.findOne({ where: { id } });
                if (secret) return secret;
                throw new NotFoundException();
            },
            10
        );
    }

    async createBotSecret(botId: string, payload: OpenBotSecretDto): Promise<OpenBotSecretDto> {
        const openBot = await this.openBotService.findById(botId);
        const botSecret = new OpenBotSecret();
        botSecret.openBot = openBot;
        botSecret.description = payload.description;
        const secretPlain = AuthorizationUtils.generateRandom(40);
        botSecret.secretHash = AuthorizationUtils.createHash(secretPlain);
        botSecret.plainReducted = secretPlain.slice(0, 3);
        const savedBotSecret = await this.openBotSecretRepository.save(botSecret);
        return savedBotSecret.toDto(secretPlain);
    }

    async update(botId: string, id: string, payload: Partial<OpenBotSecretDto>): Promise<OpenBotSecretDto> {
        const secret = await this.findByIdInOpenBot(botId, id);
        secret.description = payload.description ?? secret.description;
        secret.expiresAt = payload.expiresAt ?? secret.expiresAt;
        const saved = await this.openBotSecretRepository.save(secret);
        return saved.toDto();
    }

    async delete(botId: string, id: string): Promise<void> {
        const secret = await this.findByIdInOpenBot(botId, id);
        await this.openBotSecretRepository.delete({ id: secret.id });
    }

    async validateSecret(clientId: string, clientSecretPlain: string) {
        const openBotSecret = await this.findById(clientId);
        if (openBotSecret.secretHash !== AuthorizationUtils.createHash(clientSecretPlain)) {
            throw new UnauthorizedException('Wrong secret provided');
        }
    }
}
