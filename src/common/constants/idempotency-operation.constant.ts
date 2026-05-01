export const IdempotencyOperation = {
  WALLET_TOPUP: 'wallet.topup',
  WALLET_PAYMENT: 'wallet.payment',
  WALLET_TRANSFER: 'wallet.transfer',
} as const;

export type IdempotencyOperation = (typeof IdempotencyOperation)[keyof typeof IdempotencyOperation];