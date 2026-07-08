# LedgerFlow

LedgerFlow is a high-reliability banking simulation backend designed to demonstrate production-grade consistency patterns. It implements double-entry ledger bookkeeping, pessimistic concurrency locking, and idempotent API design principles.

---

## 🚀 Core Features & Architecture

### 1. Double-Entry Ledger Bookkeeping
Instead of storing account balances as mutable columns in an `accounts` table, balances are dynamically calculated by aggregating immutable `DEBIT` and `CREDIT` records inside a `ledger` collection. This prevents balance drift and ensures a clear, tamper-proof audit log for every transaction.

### 2. ACID Transactions & Concurrency Locking
To prevent double-spending anomalies under concurrent loads:
* Every money transfer operates inside a MongoDB session transaction.
* The system acquires a pessimistic write lock on the sender's account using atomic document updates (`findOneAndUpdate` matching `status: ACTIVE`).
* If a step fails, the transaction is aborted and rolled back.

### 3. API Idempotency
Protects client requests from network-related double execution:
* Every transaction request requires a unique `idempotencyKey`.
* Subsequent requests with the same key are intercepted. If completed, the original response is re-served; if pending, the client is told to wait; if failed, the client is instructed to retry with a new key.

### 4. System Account Auto-Seeding
Admin/system accounts can inject initial currency (seeding funds) into target user accounts. The system automatically provisions a system central-bank account to back the transaction with appropriate ledger debits.

---

## 🛠 Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB (via Mongoose)
* **Authentication:** JSON Web Tokens (JWT) + Cookie parser
* **Notifications:** NodeMailer + Google APIs (OAuth2 SMTP transport)

---

## 📂 Project Structure

```text
LedgerFlow/
├── src/
│   ├── app.js               # Express application configuration
│   ├── config/
│   │   └── db.js            # MongoDB Mongoose connection
│   ├── controllers/
│   │   ├── account.controller.js
│   │   ├── auth.controller.js
│   │   └── transaction.controller.js
│   ├── middleware/
│   │   └── auth.middleware.js # Auth and Role guards
│   ├── models/
│   │   ├── account.model.js
│   │   ├── blackList.model.js
│   │   ├── ledger.model.js
│   │   ├── transaction.model.js
│   │   └── user.model.js
│   └── services/
│       └── email.service.js   # OAuth2 transactional email service
├── server.js                # App entrypoint
└── .env.example             # Configuration template
```

---

## 🔌 API Specification

All request payloads are validated using Zod. Sensitive paths are rate-limited to 100 requests per 15 minutes per IP.

### Authentication (`/api/auth`)
* `POST /register` - Registers a new user. Requred: `name`, `email`, `password`.
* `POST /login` - Sign in. Required: `email`, `password`.
* `POST /logout` - Logs out the user and blacklists the token.

### Accounts (`/api/accounts`)
* `POST /` - Creates a new active account for the user. (Auth Required)
* `GET /` - Fetches all accounts owned by the user. (Auth Required)
* `GET /balance/:accountId` - Gets the derived ledger balance of the account. (Auth Required)
* `GET /:accountId/transactions` - Fetches paginated debit/credit transactions for the account. (Auth Required)
  * Query parameters: `?page=1&limit=10` (default page=1, limit=10)

### Transactions (`/api/transactions`)
* `POST /` - Processes a new transfer. Required: `fromAccount`, `toAccount`, `amount`, `idempotencyKey`. (Auth Required)
* `POST /system/initial-funds` - Seeds funds from the central bank. Required: `toAccount`, `amount`, `idempotencyKey`. (Admin/System Auth Required)

---

## ⚙️ Getting Started

### Prerequisites
* **Node.js** (v18+)
* **MongoDB replica set** (transactions require a replica set or MongoDB Atlas cluster)

### Installation
1. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd LedgerFlow
   npm install
   ```

2. Configure environment variables. Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:4000`.

---

## 🔒 Security & Edge Cases Handled
* **Ownership Verification:** Users can only transfer money from accounts owned by their user ID.
* **Status Verification:** Transactions can only be processed if both the sender's and receiver's accounts are `ACTIVE`.
* **Database/Network Failures:** If a ledger write fails mid-flight, the session commits a rollback and transitions the transaction document to a `FAILED` state outside the transaction boundary, triggering an email alert.
* **Token Blacklisting:** Logs out users by blacklisting JWTs until their expiration.
