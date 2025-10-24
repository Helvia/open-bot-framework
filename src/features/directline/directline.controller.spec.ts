import { Test, TestingModule } from '@nestjs/testing';
import { DirectlineController } from './directline.controller';

describe('DirectlineController', () => {
    let controller: DirectlineController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [DirectlineController]
        }).compile();

        controller = module.get<DirectlineController>(DirectlineController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
