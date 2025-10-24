import { Test, TestingModule } from '@nestjs/testing';
import { OpenBotSecretController } from './openbotsecret.controller';

describe('OpenbotsecretController', () => {
    let controller: OpenBotSecretController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [OpenBotSecretController]
        }).compile();

        controller = module.get<OpenBotSecretController>(OpenBotSecretController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
