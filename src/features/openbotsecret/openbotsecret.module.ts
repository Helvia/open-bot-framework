import { Module } from '@nestjs/common';
import { OpenBotSecretService } from './openbotsecret.service';
import { OpenBotSecretController } from './openbotsecret.controller';
import { OpenBotSecret } from 'src/entities/openbot.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpenBotModule } from '../openbot/openbot.module';
import { OpenBotService } from '../openbot/openbot.service';

@Module({
    imports: [TypeOrmModule.forFeature([OpenBotSecret]), OpenBotModule],
    providers: [OpenBotSecretService, OpenBotService],
    controllers: [OpenBotSecretController],
    exports: [OpenBotService, TypeOrmModule]
})
export class OpenBotsecretModule {}
