import { Test, TestingModule } from '@nestjs/testing';
import { WalletsRepository } from './wallets.repository';

describe('WalletsRepository', () => {
  let provider: WalletsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletsRepository],
    }).compile();

    provider = module.get<WalletsRepository>(WalletsRepository);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
