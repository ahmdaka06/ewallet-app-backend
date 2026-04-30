import { Test, TestingModule } from '@nestjs/testing';
import { LedgerRepository } from './ledger.repository';

describe('LedgerRepository', () => {
  let provider: LedgerRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LedgerRepository],
    }).compile();

    provider = module.get<LedgerRepository>(LedgerRepository);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
