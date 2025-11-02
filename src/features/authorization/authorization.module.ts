import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { JwtModule } from '@nestjs/jwt/dist/jwt.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('JWT_SECRET')
            }),
            inject: [ConfigService]
        })
    ],
    providers: [AuthorizationService],
    controllers: [AuthorizationController],
    exports: [AuthorizationService, JwtModule]
})
export class AuthorizationModule {}
