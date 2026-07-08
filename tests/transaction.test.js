const request = require("supertest")
const mongoose = require("mongoose")
const { MongoMemoryReplSet } = require("mongodb-memory-server")
const app = require("../src/app")
const userModel = require("../src/models/user.model")
const accountModel = require("../src/models/account.model")
const transactionModel = require("../src/models/transaction.model")
const ledgerModel = require("../src/models/ledger.model")

// Mock email service to prevent attempting to connect to SMTP
jest.mock("../src/services/email.service.js", () => ({
    sendRegistrationEmail: jest.fn().mockResolvedValue(true),
    sendTransactionEmail: jest.fn().mockResolvedValue(true),
    sendTransactionFailureEmail: jest.fn().mockResolvedValue(true)
}))

let mongoServer

beforeAll(async () => {
    process.env.JWT_SECRET = "test_secret_key_for_testing_12345"
    mongoServer = await MongoMemoryReplSet.create({
        replSet: { count: 1 }
    })
    const uri = mongoServer.getUri()
    await mongoose.disconnect()
    await mongoose.connect(uri)
})

afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
})

describe("Accounts & Transactions API Integration Tests", () => {
    let user1Token
    let user2Token
    let adminToken
    let user1AccId
    let user2AccId

    const user1Data = { name: "User One", email: "user1@gmail.com", password: "password123" }
    const user2Data = { name: "User Two", email: "user2@gmail.com", password: "password123" }

    // Helper: extract JWT value from the set-cookie response header
    const parseCookieToken = (res) => {
        const cookies = res.headers["set-cookie"]
        if (!cookies) return null
        const tokenCookie = cookies.find(c => c.startsWith("token="))
        if (!tokenCookie) return null
        return tokenCookie.split(";")[0].replace("token=", "")
    }

    beforeAll(async () => {
        // Register User 1
        const res1 = await request(app).post("/api/auth/register").send(user1Data)
        user1Token = parseCookieToken(res1)

        // Register User 2
        const res2 = await request(app).post("/api/auth/register").send(user2Data)
        user2Token = parseCookieToken(res2)

        // Register an Admin user directly in DB
        const adminUser = await userModel.create({
            name: "Admin User",
            email: "admin@gmail.com",
            password: "password123",
            systemUser: true
        })

        // Login Admin
        const adminRes = await request(app).post("/api/auth/login").send({
            email: adminUser.email,
            password: "password123"
        })
        adminToken = parseCookieToken(adminRes)
    })

    test("POST /api/accounts - Create Accounts", async () => {
        const res1 = await request(app)
            .post("/api/accounts")
            .set("Authorization", `Bearer ${user1Token}`)
            .send()

        expect(res1.status).toBe(201)
        expect(res1.body.account).toBeDefined()
        user1AccId = res1.body.account._id

        const res2 = await request(app)
            .post("/api/accounts")
            .set("Authorization", `Bearer ${user2Token}`)
            .send()

        expect(res2.status).toBe(201)
        expect(res2.body.account).toBeDefined()
        user2AccId = res2.body.account._id
    })

    test("POST /api/transactions/system/initial-funds - Seed Account", async () => {
        const idempotencyKey = "seed-key-1"
        const res = await request(app)
            .post("/api/transactions/system/initial-funds")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                toAccount: user1AccId,
                amount: 1000,
                idempotencyKey
            })

        expect(res.status).toBe(201)
        expect(res.body.transaction).toBeDefined()
        expect(res.body.transaction.status).toBe("COMPLETED")

        // Check user 1 balance
        const balRes = await request(app)
            .get(`/api/accounts/balance/${user1AccId}`)
            .set("Authorization", `Bearer ${user1Token}`)

        expect(balRes.status).toBe(200)
        expect(balRes.body.balance).toBe(1000)
    })

    test("POST /api/transactions - Process Transfer Success", async () => {
        const idempotencyKey = "tx-key-1"
        const res = await request(app)
            .post("/api/transactions")
            .set("Authorization", `Bearer ${user1Token}`)
            .send({
                fromAccount: user1AccId,
                toAccount: user2AccId,
                amount: 400,
                idempotencyKey
            })

        expect(res.status).toBe(201)
        expect(res.body.transaction).toBeDefined()
        expect(res.body.transaction.status).toBe("COMPLETED")

        // Check balances
        const bal1 = await request(app).get(`/api/accounts/balance/${user1AccId}`).set("Authorization", `Bearer ${user1Token}`)
        const bal2 = await request(app).get(`/api/accounts/balance/${user2AccId}`).set("Authorization", `Bearer ${user2Token}`)

        expect(bal1.body.balance).toBe(600)
        expect(bal2.body.balance).toBe(400)
    })

    test("POST /api/transactions - Block Self-Transfer", async () => {
        const res = await request(app)
            .post("/api/transactions")
            .set("Authorization", `Bearer ${user1Token}`)
            .send({
                fromAccount: user1AccId,
                toAccount: user1AccId,
                amount: 100,
                idempotencyKey: "tx-key-self"
            })

        expect(res.status).toBe(400)
        expect(res.body.message).toBe("Cannot transfer funds to the same account")
    })

    test("POST /api/transactions - Block Insufficient Balance", async () => {
        const res = await request(app)
            .post("/api/transactions")
            .set("Authorization", `Bearer ${user1Token}`)
            .send({
                fromAccount: user1AccId,
                toAccount: user2AccId,
                amount: 2000, // Balance is 600
                idempotencyKey: "tx-key-insufficient"
            })

        expect(res.status).toBe(400)
        expect(res.body.message).toContain("Insufficient balance")
    })

    test("POST /api/transactions - Idempotence replay protection", async () => {
        // Retry existing COMPLETED transaction with same key
        const res = await request(app)
            .post("/api/transactions")
            .set("Authorization", `Bearer ${user1Token}`)
            .send({
                fromAccount: user1AccId,
                toAccount: user2AccId,
                amount: 400,
                idempotencyKey: "tx-key-1"
            })

        expect(res.status).toBe(200)
        expect(res.body.message).toBe("Transaction already processed")
        expect(res.body.transaction.status).toBe("COMPLETED")
    })

    test("GET /api/accounts/:id/transactions - Paginated Transaction History", async () => {
        const res = await request(app)
            .get(`/api/accounts/${user1AccId}/transactions?page=1&limit=1`)
            .set("Authorization", `Bearer ${user1Token}`)

        expect(res.status).toBe(200)
        expect(res.body.transactions).toHaveLength(1)
        expect(res.body.page).toBe(1)
        expect(res.body.limit).toBe(1)
        expect(res.body.totalEntries).toBe(2) // 1 debit (transfer) + 1 credit (seeding)
    })
})
