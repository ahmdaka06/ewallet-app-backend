/*
  Warnings:

  - Changed the type of `currency` on the `ledger_entries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `currency` on the `wallets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "WalletCurrency" AS ENUM ('IDR', 'USD', 'EUR', 'MYR');

-- AlterTable
ALTER TABLE "ledger_entries" DROP COLUMN "currency",
ADD COLUMN     "currency" "WalletCurrency" NOT NULL;

-- AlterTable
ALTER TABLE "wallets" DROP COLUMN "currency",
ADD COLUMN     "currency" "WalletCurrency" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wallets_owner_id_currency_key" ON "wallets"("owner_id", "currency");
