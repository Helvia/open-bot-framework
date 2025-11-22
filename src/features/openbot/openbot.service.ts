import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OpenBotDto } from 'src/dto/openbot.dto';
import { PaginatedTransform } from 'src/dto/page.dto';
import { OpenBot } from 'src/entities/openbot.entity';
import { FindManyOptions, QueryFailedError } from 'typeorm';
import { Repository } from 'typeorm/repository/Repository';
import { Cache } from 'cache-manager';

@Injectable()
export class OpenBotService {
    constructor(
        @InjectRepository(OpenBot)
        private readonly openBotRepository: Repository<OpenBot>,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache
    ) {}

    async findAll(page: number, pageSize: number): Promise<PaginatedTransform<OpenBot, OpenBotDto>> {
        let selectSkip: FindManyOptions<OpenBot> = {};
        if (!isNaN(page) && !isNaN(pageSize)) {
            selectSkip = {
                take: pageSize,
                skip: page * pageSize
            } as FindManyOptions<OpenBot>;
        }
        return new PaginatedTransform(await this.openBotRepository.findAndCount(selectSkip), page, pageSize, d =>
            d.toDto()
        );
    }

    async findById(id: string): Promise<OpenBot> {
        const openBot = await this.openBotRepository.findOneBy({ id });
        if (openBot) {
            return openBot;
        }
        throw new NotFoundException();
    }

    // Never expose to controller
    async findByHandleCached(handle: string): Promise<OpenBot> {
        return this.cacheManager.wrap(
            handle,
            async () => {
                const openBot = await this.openBotRepository.findOneBy({ handle });
                if (openBot) {
                    return openBot;
                }
                throw new NotFoundException();
            },
            10
        );
    }

    async create(openBotDto: OpenBotDto): Promise<OpenBotDto> {
        const openBot = new OpenBot();
        openBot.handle = openBotDto.handle;
        openBot.endpoint = openBotDto.endpoint;
        openBot.schemaVersion = 'V1.3';
        try {
            return (await this.openBotRepository.save(openBot)).toDto();
        } catch (e: unknown) {
            if (e instanceof QueryFailedError) {
                const driverError = e as QueryFailedError & { constraint: string };
                if (driverError.constraint === 'IDX_OpenBot_handle') {
                    throw new HttpException('The handle provided already exists', HttpStatus.CONFLICT);
                }
            }
            throw new HttpException(`An error prevented this entity from persisting`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async update(id: string, openBotDto: Partial<OpenBotDto>): Promise<OpenBotDto> {
        const openBot = await this.findById(id);
        openBot.endpoint = openBotDto.endpoint ?? openBot.endpoint;
        openBot.schemaVersion = openBotDto.schemaVersion ?? openBot.schemaVersion;
        return (await this.openBotRepository.save(openBot)).toDto();
    }

    async delete(id: string): Promise<void> {
        const openBot = await this.findById(id);
        await this.openBotRepository.delete({ id: openBot.id });
    }
}
