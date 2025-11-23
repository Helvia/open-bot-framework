import { Module } from '@nestjs/common';
import { AtomicOperationsProvider } from './atomic-operations.provider';
import { AtomicOperationsService } from './atomic-operations.service';

@Module({
    imports: [],
    providers: [AtomicOperationsProvider, AtomicOperationsService],
    controllers: [],
    exports: [AtomicOperationsProvider]
})
export class AtomicOperationsModule {}
