import { Test, TestingModule } from '@nestjs/testing';
import { OpenBotController } from './openbot.controller';

describe('OpenBotController', () => {
    let controller: OpenBotController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [OpenBotController]
        }).compile();

        controller = module.get<OpenBotController>(OpenBotController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
