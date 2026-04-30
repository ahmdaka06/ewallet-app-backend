import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyRepository } from './idempotency.repository';

describe('IdempotencyRepository', () => {
  let provider: IdempotencyRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IdempotencyRepository],
    }).compile();

    provider = module.get<IdempotencyRepository>(IdempotencyRepository);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
