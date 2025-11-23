import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ClassSerializerInterceptor } from '@nestjs/common';
import multipart from '@fastify/multipart';
import { AllExceptionsFilter } from './filters/exception.filter';

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(multipart, {
        limits: {
            fileSize: 10 * 1024 * 1024
        }
    });
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
    });
    await app.listen(process.env.PORT ?? 1986, '0.0.0.0');
}
console.log(` _____                                                                                  _____ 
( ___ )                                                                                ( ___ )
 |   |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|   | 
 |   |                                                                                  |   | 
 |   |   ██████╗ ██████╗ ███████╗███╗   ██╗    ██████╗  ██████╗ ████████╗               |   | 
 |   |  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║    ██╔══██╗██╔═══██╗╚══██╔══╝               |   | 
 |   |  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║    ██████╔╝██║   ██║   ██║                  |   | 
 |   |  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║    ██╔══██╗██║   ██║   ██║                  |   | 
 |   |  ╚██████╔╝██║     ███████╗██║ ╚████║    ██████╔╝╚██████╔╝   ██║                  |   | 
 |   |   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝    ╚═════╝  ╚═════╝    ╚═╝                  |   | 
 |   |                                                                                  |   | 
 |   |  ███████╗██████╗  █████╗ ███╗   ███╗███████╗██╗    ██╗ ██████╗ ██████╗ ██╗  ██╗  |   | 
 |   |  ██╔════╝██╔══██╗██╔══██╗████╗ ████║██╔════╝██║    ██║██╔═══██╗██╔══██╗██║ ██╔╝  |   | 
 |   |  █████╗  ██████╔╝███████║██╔████╔██║█████╗  ██║ █╗ ██║██║   ██║██████╔╝█████╔╝   |   | 
 |   |  ██╔══╝  ██╔══██╗██╔══██║██║╚██╔╝██║██╔══╝  ██║███╗██║██║   ██║██╔══██╗██╔═██╗   |   | 
 |   |  ██║     ██║  ██║██║  ██║██║ ╚═╝ ██║███████╗╚███╔███╔╝╚██████╔╝██║  ██║██║  ██╗  |   | 
 |   |  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝ ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  |   | 
 |   |                                                                                  |   | 
 |___|~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|___| 
(_____)                                                                                (_____)`);
void bootstrap();
