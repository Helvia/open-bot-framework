import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // added import
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { OpenBotModule } from './features/openbot/openbot.module';
import { OpenbotsecretModule } from './features/openbotsecret/openbotsecret.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: ['.env.local', '.env'],
            isGlobal: true
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) =>
                ({
                    type: configService.get('TYPEORM_CONNECTION') as 'postgres',
                    host: configService.get('TYPEORM_HOST'),
                    port: Number(configService.get<number>('TYPEORM_PORT')),
                    username: configService.get('TYPEORM_USERNAME'),
                    password: configService.get('TYPEORM_PASSWORD'),
                    database: configService.get('TYPEORM_DATABASE'),
                    entities: [__dirname + '/**/*.entity{.ts,.js}'],
                    migrations: [__dirname + '/../migrations/*.js'],
                    migrationsRun: configService.get('TYPEORM_AUTORUN_MIGRATIONS') === 'true',
                    synchronize: true,
                    autoLoadEntities: true,
                    dropSchema: false
                }) as PostgresConnectionOptions,
            inject: [ConfigService]
        }),
        OpenBotModule,
        OpenbotsecretModule
    ],
    controllers: [AppController],
    providers: [AppService]
})
export class AppModule {}
