import { Test, TestingModule } from '@nestjs/testing';
import { DirectlineService } from './directline.service';

describe('DirectlineService', () => {
    let service: DirectlineService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [DirectlineService]
        }).compile();

        service = module.get<DirectlineService>(DirectlineService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
