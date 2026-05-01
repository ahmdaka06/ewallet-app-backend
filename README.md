# E-Wallet Backend API

Backend API untuk sistem **e-wallet multi-currency** yang dibangun menggunakan **NestJS**, **TypeScript**, **Prisma ORM v7**, **PostgreSQL**, dan **Redis**.

Project ini mencakup autentikasi, manajemen wallet, top-up, payment, transfer antar wallet, ledger history, audit balance wallet, refresh token rotation, idempotency protection, serta rate limiting menggunakan Redis.

---

## Database Schema

![Database Schema](./schema.png)

---

## Tech Stack

- **Node.js**
- **NestJS**
- **TypeScript**
- **PostgreSQL**
- **Prisma ORM v7**
- **Redis**
- **JWT Authentication**
- **bcrypt**
- **class-validator**
- **Swagger / OpenAPI**
- **Jest**

---

## Fitur Utama

- Registrasi user
- Login user
- JWT access token
- JWT refresh token
- Refresh token rotation
- Logout dengan revoke refresh token
- Mengambil data user yang sedang login
- Membuat wallet
- Multi-currency wallet
- Satu wallet per currency untuk setiap user
- Top-up saldo wallet
- Payment dari saldo wallet
- Transfer antar wallet
- Ledger entry untuk setiap perubahan saldo
- Audit balance wallet terhadap ledger
- Proteksi wallet dengan status suspended
- Idempotency key untuk operasi yang mengubah saldo
- Rate limiting menggunakan Redis
- Unit test untuk service dan controller

---

## Requirements

Versi yang direkomendasikan:

```txt
Node.js >= 20
pnpm >= 9
Docker
Docker Compose
PostgreSQL >= 15
Redis >= 7
```

Cek versi yang terinstall:

```bash
node -v
pnpm -v
docker -v
docker compose version
```

---

## Instalasi

Clone repository:

```bash
git clone https://github.com/ahmdaka06/ewallet-app-backend.git
cd ewallet-app-backend
```

Install dependencies:

```bash
pnpm install
```

Install package Redis storage untuk throttling:

```bash
pnpm add @nest-lab/throttler-storage-redis ioredis
```

---

## Docker Services

Project ini menggunakan Docker Compose untuk menjalankan PostgreSQL dan Redis.

Contoh `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: ewallet-postgres
    restart: always
    environment:
      POSTGRES_USER: ewallet
      POSTGRES_PASSWORD: ewallet
      POSTGRES_DB: ewallet_db
    ports:
      - "5432:5432"
    volumes:
      - ewallet_postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: ewallet-redis
    restart: always
    ports:
      - "6379:6379"

volumes:
  ewallet_postgres_data:
```

Jalankan service:

```bash
docker compose up -d
```

Cek container:

```bash
docker compose ps
```

Cek Redis:

```bash
docker exec -it ewallet-redis redis-cli ping
```

Expected output:

```txt
PONG
```

Cek PostgreSQL:

```bash
docker exec -it ewallet-postgres psql -U ewallet -d ewallet_db
```

---

## Environment Variables

Buat file `.env`:

```bash
cp .env.example .env
```

Contoh isi `.env`:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://ewallet:ewallet@localhost:5432/ewallet_db"

REDIS_URL="redis://localhost:6379"

JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

THROTTLE_TTL_SECONDS=60
THROTTLE_LIMIT=30
```

Penjelasan rate limit:

```txt
THROTTLE_TTL_SECONDS=60
THROTTLE_LIMIT=30
```

Artinya maksimal **30 request dalam 60 detik**.

Throttling menggunakan Redis storage melalui `@nest-lab/throttler-storage-redis`, sehingga counter rate limit dapat dibagikan antar instance aplikasi.

---

## Setup Database

Generate Prisma Client:

```bash
pnpm prisma generate
```

Jalankan migration:

```bash
pnpm prisma migrate dev
```

Membuat migration baru:

```bash
pnpm prisma migrate dev --name <nama_migration>
```

Membuka Prisma Studio:

```bash
pnpm prisma studio
```

---

## Database Seeder

Project ini menyediakan seed command untuk users dan wallets.

Script seed yang tersedia:

```json
{
  "db:seed": "tsx prisma/seed/index.ts all",
  "db:seed:users": "tsx prisma/seed/index.ts users",
  "db:seed:wallets": "tsx prisma/seed/index.ts wallets"
}
```

Menjalankan semua seeder:

```bash
pnpm db:seed
```

Seed users saja:

```bash
pnpm db:seed:users
```

Seed wallets saja:

```bash
pnpm db:seed:wallets
```

Urutan manual yang direkomendasikan:

```bash
pnpm db:seed:users
pnpm db:seed:wallets
```

Seeder wallet membutuhkan data user, sehingga user harus di-seed terlebih dahulu sebelum wallet.

---

## Menjalankan Aplikasi

Jalankan aplikasi dalam mode development:

```bash
pnpm start:dev
```

Build project:

```bash
pnpm build
```

Jalankan hasil build production:

```bash
pnpm start:prod
```

Default base URL API:

```txt
http://localhost:3000/api/v1
```

Swagger documentation:

```txt
http://localhost:3000/api-docs
```

Jika path Swagger berbeda, cek konfigurasi Swagger di `main.ts`.

---

## Testing

Menjalankan semua unit test:

```bash
pnpm test
```

Menjalankan file test tertentu:

```bash
pnpm test -- auth.service.spec.ts
pnpm test -- auth.controller.spec.ts
pnpm test -- wallets.service.spec.ts
pnpm test -- wallets.controller.spec.ts
pnpm test -- ledger.service.spec.ts
pnpm test -- idempotency.service.spec.ts
```

Menjalankan test coverage:

```bash
pnpm test:cov
```

Unit test mencakup:

- Auth service
- Auth controller
- Wallet service
- Wallet controller
- Ledger service
- Idempotency service

Race condition lebih tepat diuji menggunakan integration test atau e2e test dengan database PostgreSQL asli, karena unit test dengan mock tidak bisa sepenuhnya memverifikasi database isolation, row-level locking, dan rollback transaction.

---

## Format Response API

Response sukses mengikuti format berikut:

```json
{
  "status": true,
  "message": "Success",
  "data": {}
}
```

Contoh response daftar wallet:

```json
{
  "status": true,
  "message": "Wallets retrieved successfully",
  "data": [
    {
      "id": "wallet-id",
      "ownerId": "user-id",
      "currency": "IDR",
      "balance": "10000.00",
      "status": "ACTIVE",
      "createdAt": "2026-05-01T22:08:41.325Z",
      "updatedAt": "2026-05-01T22:08:41.325Z"
    }
  ]
}
```

---

## Autentikasi

Endpoint yang protected membutuhkan Bearer Token:

```http
Authorization: Bearer <access_token>
```

---

# API Examples

## Auth API

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json
```

Request body:

```json
{
  "name": "Demo User",
  "email": "demo@example.com",
  "password": "password123"
}
```

Contoh response:

```json
{
  "status": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user-id",
      "name": "Demo User",
      "email": "demo@example.com"
    },
    "accessToken": "access-token",
    "refreshToken": "refresh-token"
  }
}
```

---

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

Request body:

```json
{
  "email": "demo@example.com",
  "password": "password123"
}
```

Contoh response:

```json
{
  "status": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-id",
      "name": "Demo User",
      "email": "demo@example.com"
    },
    "accessToken": "access-token",
    "refreshToken": "refresh-token"
  }
}
```

---

### Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json
```

Request body:

```json
{
  "refreshToken": "refresh-token"
}
```

Contoh response:

```json
{
  "status": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "id": "user-id",
      "name": "Demo User",
      "email": "demo@example.com"
    },
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token"
  }
}
```

---

### Logout

```http
POST /api/v1/auth/logout
Content-Type: application/json
```

Request body:

```json
{
  "refreshToken": "refresh-token"
}
```

Contoh response:

```json
{
  "status": true,
  "message": "Logout successful",
  "data": null
}
```

---

### Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

Contoh response:

```json
{
  "status": true,
  "message": "Authenticated user retrieved successfully",
  "data": {
    "user": {
      "id": "user-id",
      "name": "Demo User",
      "email": "demo@example.com"
    }
  }
}
```

---

## Wallet API

### Create Wallet

```http
POST /api/v1/wallets
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request body:

```json
{
  "currency": "IDR"
}
```

Contoh response:

```json
{
  "status": true,
  "message": "Wallet created successfully",
  "data": {
    "id": "wallet-id",
    "ownerId": "user-id",
    "currency": "IDR",
    "balance": "0.00",
    "status": "ACTIVE",
    "createdAt": "2026-05-01T22:08:41.325Z",
    "updatedAt": "2026-05-01T22:08:41.325Z"
  }
}
```

---

### Get My Wallets

```http
GET /api/v1/wallets
Authorization: Bearer <access_token>
```

Contoh response:

```json
{
  "status": true,
  "message": "Wallets retrieved successfully",
  "data": [
    {
      "id": "wallet-id",
      "ownerId": "user-id",
      "currency": "IDR",
      "balance": "10000.00",
      "status": "ACTIVE",
      "createdAt": "2026-05-01T22:08:41.325Z",
      "updatedAt": "2026-05-01T22:08:41.325Z"
    }
  ]
}
```

---

### Get Wallet Detail

```http
GET /api/v1/wallets/:walletId
Authorization: Bearer <access_token>
```

Contoh response:

```json
{
  "status": true,
  "message": "Wallet retrieved successfully",
  "data": {
    "id": "wallet-id",
    "ownerId": "user-id",
    "currency": "IDR",
    "balance": "10000.00",
    "status": "ACTIVE",
    "createdAt": "2026-05-01T22:08:41.325Z",
    "updatedAt": "2026-05-01T22:08:41.325Z"
  }
}
```

---

## Idempotency

Operasi yang mengubah saldo wajib menggunakan header `Idempotency-Key`.

Wajib untuk endpoint berikut:

```txt
POST /api/v1/wallets/:walletId/topup
POST /api/v1/wallets/:walletId/pay
POST /api/v1/wallets/transfer
```

Contoh header:

```http
Idempotency-Key: topup-wallet-001
```

Aturan idempotency:

- Key yang sama dengan payload request yang sama tidak boleh memproses operasi dua kali.
- Key yang sama dengan payload request yang sama dapat mengembalikan cached response.
- Key yang sama dengan payload request berbeda akan ditolak.
- Fitur ini melindungi operasi top-up, payment, dan transfer dari duplicate request akibat retry client atau double click.

---

### Top Up Wallet

```http
POST /api/v1/wallets/:walletId/topup
Authorization: Bearer <access_token>
Idempotency-Key: topup-wallet-001
Content-Type: application/json
```

Request body:

```json
{
  "amount": "10000.00"
}
```

Contoh response:

```json
{
  "status": true,
  "message": "Wallet topped up successfully",
  "data": {
    "wallet": {
      "id": "wallet-id",
      "ownerId": "user-id",
      "currency": "IDR",
      "balance": "20000.00",
      "status": "ACTIVE",
      "createdAt": "2026-05-01T22:08:41.325Z",
      "updatedAt": "2026-05-01T22:08:41.325Z"
    },
    "referenceId": "reference-id"
  }
}
```

Perilaku decimal:

```txt
12.345 -> 12.35
0.001  -> rejected
0.00   -> rejected
-10.00 -> rejected
```

---

### Pay From Wallet

```http
POST /api/v1/wallets/:walletId/pay
Authorization: Bearer <access_token>
Idempotency-Key: payment-wallet-001
Content-Type: application/json
```

Request body:

```json
{
  "amount": "5000.00"
}
```

Contoh response:

```json
{
  "status": true,
  "message": "Payment successful",
  "data": {
    "wallet": {
      "id": "wallet-id",
      "ownerId": "user-id",
      "currency": "IDR",
      "balance": "15000.00",
      "status": "ACTIVE",
      "createdAt": "2026-05-01T22:08:41.325Z",
      "updatedAt": "2026-05-01T22:08:41.325Z"
    },
    "referenceId": "reference-id"
  }
}
```

---

### Transfer Antar Wallet

```http
POST /api/v1/wallets/transfer
Authorization: Bearer <access_token>
Idempotency-Key: transfer-wallet-001
Content-Type: application/json
```

Request body:

```json
{
  "fromWalletId": "source-wallet-id",
  "toWalletId": "destination-wallet-id",
  "amount": "2500.00"
}
```

Contoh response:

```json
{
  "status": true,
  "message": "Transfer successful",
  "data": {
    "fromWallet": {
      "id": "source-wallet-id",
      "ownerId": "user-id",
      "currency": "IDR",
      "balance": "7500.00",
      "status": "ACTIVE",
      "createdAt": "2026-05-01T22:08:41.325Z",
      "updatedAt": "2026-05-01T22:08:41.325Z"
    },
    "toWallet": {
      "id": "destination-wallet-id",
      "ownerId": "receiver-user-id",
      "currency": "IDR",
      "balance": "12500.00",
      "status": "ACTIVE",
      "createdAt": "2026-05-01T22:08:41.325Z",
      "updatedAt": "2026-05-01T22:08:41.325Z"
    },
    "referenceId": "reference-id"
  }
}
```

Aturan transfer:

- Wallet sumber dan wallet tujuan tidak boleh sama.
- Wallet sumber dan wallet tujuan harus memiliki currency yang sama.
- Wallet sumber harus memiliki saldo yang cukup.
- Wallet suspended tidak bisa mengirim atau menerima transfer.
- Operasi debit dan credit dilakukan secara atomic.

---

### Suspend Wallet

```http
PATCH /api/v1/wallets/:walletId/suspend
Authorization: Bearer <access_token>
```

Contoh response:

```json
{
  "status": true,
  "message": "Wallet suspended successfully",
  "data": {
    "id": "wallet-id",
    "ownerId": "user-id",
    "currency": "IDR",
    "balance": "10000.00",
    "status": "SUSPENDED",
    "createdAt": "2026-05-01T22:08:41.325Z",
    "updatedAt": "2026-05-01T22:08:41.325Z"
  }
}
```

---

### Activate Wallet

```http
PATCH /api/v1/wallets/:walletId/active
Authorization: Bearer <access_token>
```

Contoh response:

```json
{
  "status": true,
  "message": "Wallet activated successfully",
  "data": {
    "id": "wallet-id",
    "ownerId": "user-id",
    "currency": "IDR",
    "balance": "10000.00",
    "status": "ACTIVE",
    "createdAt": "2026-05-01T22:08:41.325Z",
    "updatedAt": "2026-05-01T22:08:41.325Z"
  }
}
```

---

### Get Wallet Ledgers

```http
GET /api/v1/wallets/:walletId/ledgers
Authorization: Bearer <access_token>
```

Contoh response:

```json
{
  "status": true,
  "message": "Wallet ledgers retrieved successfully",
  "data": [
    {
      "id": "ledger-id",
      "walletId": "wallet-id",
      "type": "TOPUP",
      "direction": "CREDIT",
      "amount": "10000.00",
      "currency": "IDR",
      "balanceBefore": "0.00",
      "balanceAfter": "10000.00",
      "referenceId": "reference-id",
      "metadata": null,
      "createdAt": "2026-05-01T22:08:41.325Z"
    }
  ]
}
```

---

### Audit Wallet Balance

```http
GET /api/v1/wallets/:walletId/audit
Authorization: Bearer <access_token>
```

Contoh response:

```json
{
  "status": true,
  "message": "Wallet balance audit completed",
  "data": {
    "walletId": "wallet-id",
    "currency": "IDR",
    "storedBalance": "10000.00",
    "computedBalance": "10000.00",
    "isBalanced": true
  }
}
```

---

## Aturan Ledger

Setiap operasi yang mengubah saldo akan membuat ledger entry.

| Operation | Ledger Type | Direction |
|---|---|---|
| Top Up | `TOPUP` | `CREDIT` |
| Payment | `PAYMENT` | `DEBIT` |
| Transfer Out | `TRANSFER_OUT` | `DEBIT` |
| Transfer In | `TRANSFER_IN` | `CREDIT` |

Balance wallet harus selalu sesuai dengan total dari ledger entries.

---

## Business Rules dan Asumsi

### Multi-Currency Wallet

- User dapat memiliki lebih dari satu wallet.
- User hanya boleh memiliki satu wallet untuk setiap currency.
- Transfer hanya diperbolehkan antar wallet dengan currency yang sama.
- Currency conversion tidak didukung.

### Decimal dan Money Handling

- Money disimpan menggunakan fixed-point decimal type.
- Amount dinormalisasi menjadi dua angka desimal.
- Amount di bawah `0.01` akan ditolak.
- Amount `0.00` dan nominal negatif akan ditolak.
- Balance besar seperti `1,000,000,000.00` atau lebih tetap didukung.

### Idempotency

- `Idempotency-Key` wajib untuk top-up, payment, dan transfer.
- Duplicate request dengan key dan payload yang sama tidak akan mengubah saldo lebih dari satu kali.
- Penggunaan key yang sama dengan payload berbeda akan ditolak.
- Duplicate request yang sudah completed dapat mengembalikan cached response.

### Rate Limiting

- Rate limiting menggunakan `@nestjs/throttler`.
- Storage rate limit menggunakan Redis melalui `@nest-lab/throttler-storage-redis`.
- Default limit dikonfigurasi melalui environment variable:
  - `THROTTLE_TTL_SECONDS`
  - `THROTTLE_LIMIT`

Contoh:

```env
THROTTLE_TTL_SECONDS=60
THROTTLE_LIMIT=30
```

Artinya maksimal 30 request dalam 60 detik.

### Concurrency

- Mutasi saldo wallet dijalankan di dalam database transaction.
- Serializable isolation dan row-level locking digunakan untuk mengurangi risiko race condition.
- Payment dan transfer selalu memvalidasi saldo sebelum melakukan pengurangan.
- Partial failure pada transfer tidak boleh meninggalkan wallet dalam kondisi tidak konsisten.

### Suspended Wallet

Wallet dengan status suspended tidak dapat:

- Menerima top-up
- Melakukan payment
- Mengirim transfer
- Menerima transfer

---

## Suggested Test Scenarios

Project ini mencakup atau disarankan mencakup test untuk:

- Register user
- Login user
- Refresh token rotation
- Logout
- Get authenticated user
- Create wallet
- Mencegah duplicate wallet pada currency yang sama
- Get user wallets
- Get wallet detail
- Top-up wallet
- Decimal rounding: `12.345 -> 12.35`
- Reject amount di bawah `0.01`
- Reject zero atau negative amount
- Pay from wallet
- Reject payment jika saldo tidak cukup
- Transfer antar wallet dengan currency yang sama
- Reject transfer antar wallet dengan currency berbeda
- Reject transfer ke wallet yang sama
- Reject operasi pada suspended wallet
- Ledger formatting
- Wallet balance audit
- Idempotency duplicate request handling

---

## Project Structure

Contoh struktur project:

```txt
src
├── app
│   ├── auth
│   │   ├── dto
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   └── auth.module.ts
│   ├── users
│   │   ├── users.module.ts
│   │   └── users.service.ts
│   ├── wallets
│   │   ├── dto
│   │   ├── wallets.controller.ts
│   │   ├── wallets.service.ts
│   │   ├── wallets.repository.ts
│   │   └── wallets.module.ts
│   ├── ledger
│   │   ├── dto
│   │   ├── ledger.service.ts
│   │   ├── ledger.repository.ts
│   │   └── ledger.module.ts
│   └── idempotency
│       ├── idempotency.service.ts
│       ├── idempotency.repository.ts
│       └── idempotency.module.ts
├── common
│   ├── decorators
│   ├── guards
│   ├── interceptors
│   ├── types
│   └── constants
├── shared
│   ├── config
│   └── prisma
│   └── redis
│   shared.module.ts
└── generated
    └── prisma
```

---

## Useful Commands

```bash
pnpm install

docker compose up -d
docker compose ps

pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma studio

pnpm db:seed
pnpm db:seed:users
pnpm db:seed:wallets

pnpm start:dev
pnpm build
pnpm start:prod

pnpm test
pnpm test:cov
```

---

## Notes

Project ini berfokus pada correctness dan consistency untuk operasi saldo wallet.

Operasi penting yang mengubah saldo dilindungi oleh validasi, ledger records, database transaction, idempotency key, dan rate limiting berbasis Redis.