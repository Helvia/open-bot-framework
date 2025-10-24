import { Injectable, NotFoundException } from '@nestjs/common';
import { OpenBotSecretDto } from 'src/dto/openbot.dto';
import { OpenBotSecret } from 'src/entities/openbot.entity';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { OpenBotService } from '../openbot/openbot.service';
import { PaginatedTransform } from 'src/dto/page.dto';

@Injectable()
export class OpenBotSecretService {
    constructor(
        private readonly openBotService: OpenBotService,
        @InjectRepository(OpenBotSecret)
        private readonly openBotSecretRepository: Repository<OpenBotSecret>
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

    async findById(botId: string, id: string): Promise<OpenBotSecret> {
        const openBot = await this.openBotService.findById(botId);
        // query by secret id and the related openBot id
        const secret = await this.openBotSecretRepository.findOne({ where: { id, openBot: { id: openBot.id } } });
        if (secret) return secret;
        throw new NotFoundException();
    }

    async createBotSecret(botId: string, payload: OpenBotSecretDto): Promise<OpenBotSecretDto> {
        const openBot = await this.openBotService.findById(botId);
        const botSecret = new OpenBotSecret();
        botSecret.openBot = openBot;
        botSecret.description = payload.description;
        const secretPlain = this.generateRandom(40);
        botSecret.secretHash = crypto.createHash('sha256').update(secretPlain).digest('hex');
        botSecret.plainReducted = secretPlain.slice(0, 3);
        const savedBotSecret = await this.openBotSecretRepository.save(botSecret);
        return savedBotSecret.toDto(secretPlain);
    }

    async update(botId: string, id: string, payload: Partial<OpenBotSecretDto>): Promise<OpenBotSecretDto> {
        const secret = await this.findById(botId, id);
        secret.description = payload.description ?? secret.description;
        secret.expiresAt = payload.expiresAt ?? secret.expiresAt;
        const saved = await this.openBotSecretRepository.save(secret);
        return saved.toDto();
    }

    async delete(botId: string, id: string): Promise<void> {
        const secret = await this.findById(botId, id);
        await this.openBotSecretRepository.delete({ id: secret.id });
    }

    private generateRandom(length: number) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-~';
        const bytes = crypto.randomBytes(length);
        return Array.from(bytes)
            .map(b => chars[b % chars.length])
            .join('');
    }
}
