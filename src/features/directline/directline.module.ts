import { Module } from '@nestjs/common';
import { DirectlineService } from './directline.service';
import { DirectlineController } from './directline.controller';

@Module({
    providers: [DirectlineService],
    controllers: [DirectlineController]
})
export class DirectlineModule {}
