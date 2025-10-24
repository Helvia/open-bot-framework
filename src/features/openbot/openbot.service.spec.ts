import { Test, TestingModule } from '@nestjs/testing';
import { OpenBotService } from './openbot.service';

describe('OpenBotService', () => {
    let service: OpenBotService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [OpenBotService]
        }).compile();

        service = module.get<OpenBotService>(OpenBotService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
