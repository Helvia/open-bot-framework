import { Test, TestingModule } from '@nestjs/testing';
import { DirectlineConversationService } from './directline-conversation.service';

describe('DirectlineService', () => {
    let service: DirectlineConversationService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [DirectlineConversationService]
        }).compile();

        service = module.get<DirectlineConversationService>(DirectlineConversationService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
