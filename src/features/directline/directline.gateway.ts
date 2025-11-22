import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Server as WSServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Transcript } from 'botframework-schema';
import { ConfigService } from '@nestjs/config';
import { DirectlineTokenService } from './dirtectline-token.service';

@Injectable()
export class DirectLineGateway implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(this.constructor.name);
    private wss: WSServer;
    // Conversation id to socket
    private readonly socketMeta = new Map<string, WebSocket>();
    private readonly socketPort: number;

    constructor(
        private readonly directLineTokenService: DirectlineTokenService,
        configService: ConfigService
    ) {
        this.socketPort = Number(configService.get<number>('SOCKET_PORT'));
    }

    onModuleInit() {
        this.wss = new WSServer({ port: this.socketPort });

        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
            const url = (req && req.url) || '';
            try {
                const parsedUrl = new URL(`wss://server${url}`);
                // Verify token
                const token = parsedUrl.searchParams.get('t');
                if (token !== null) {
                    const directLineTokenPayload = this.directLineTokenService.verifyDirectLineToken(token, false);
                    // User authenticated here
                    const match = parsedUrl.pathname.match(/^\/v3\/directline\/conversations\/([^/]+)\/stream$/);
                    if (!match || match[1] !== directLineTokenPayload.conv) {
                        throw new BadRequestException('Erroneous link');
                    }
                    this.socketMeta.set(directLineTokenPayload.conv, ws);
                    this.logger.verbose(`Web-socket connected for conversation ${directLineTokenPayload.conv}`);
                }
            } catch (e: unknown) {
                ws.send(JSON.stringify({ error: e }));
                ws.close();
                return;
            }

            ws.on('error', (err: Error) => {
                this.logger.error(`WebSocket error ${err}`);
            });
        });

        this.wss.on('listening', () => {
            this.logger.log('WebSocket server started');
        });

        this.wss.on('error', (err: Error) => {
            this.logger.error(`WebSocket error ${err}`);
        });
    }

    onModuleDestroy() {
        if (this.wss) {
            this.wss.close();
        }
    }

    sendToConversation(convId: string, activityPayload: Transcript) {
        const wsConnection = this.socketMeta.get(convId);
        if (wsConnection) {
            // Direct string transmission
            wsConnection.send(JSON.stringify(activityPayload));
        }
    }
}
