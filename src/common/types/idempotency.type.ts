import type { Request } from 'express';

export type IdempotencyContext = {
  key: string;
  requestHash: string;
};

export type IdempotentRequest = Request & {
  idempotency?: IdempotencyContext;
};