import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';

@Module({
    providers: [AuthorizationService],
    controllers: [AuthorizationController]
})
export class AuthorizationModule {}
