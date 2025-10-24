import { Test, TestingModule } from '@nestjs/testing';
import { OpenBotSecretService } from './openbotsecret.service';

describe('OpenbotsecretService', () => {
    let service: OpenBotSecretService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [OpenBotSecretService]
        }).compile();

        service = module.get<OpenBotSecretService>(OpenBotSecretService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
