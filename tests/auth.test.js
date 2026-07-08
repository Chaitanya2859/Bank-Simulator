const request = require("supertest")
const mongoose = require("mongoose")
const { MongoMemoryReplSet } = require("mongodb-memory-server")
const app = require("../src/app")
const userModel = require("../src/models/user.model")

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
    await mongoose.disconnect() // Disconnect from real DB if connected
    await mongoose.connect(uri)
})

afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
})

beforeEach(async () => {
    await userModel.deleteMany({})
})

describe("Authentication API Integration Tests", () => {
    const testUser = {
        name: "Test User",
        email: "testuser@gmail.com",
        password: "password123"
    }

    test("POST /api/auth/register - Success", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send(testUser)

        expect(res.status).toBe(201)
        expect(res.body.user).toBeDefined()
        expect(res.body.user.email).toBe(testUser.email)
        // Token is delivered via httpOnly cookie — NOT in response body
        expect(res.body.token).toBeUndefined()
        expect(res.headers["set-cookie"]).toBeDefined()

        const dbUser = await userModel.findOne({ email: testUser.email })
        expect(dbUser).toBeDefined()
        expect(dbUser.name).toBe(testUser.name)
    })

    test("POST /api/auth/register - Validation Fail", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({ name: "", email: "not-an-email", password: "123" })

        expect(res.status).toBe(400)
        expect(res.body.message).toBe("Validation failed")
    })

    test("POST /api/auth/login - Success", async () => {
        // Register user first
        await request(app)
            .post("/api/auth/register")
            .send(testUser)

        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: testUser.email,
                password: testUser.password
            })

        expect(res.status).toBe(200)
        // Token in cookie only, not body
        expect(res.body.token).toBeUndefined()
        expect(res.headers["set-cookie"]).toBeDefined()
        expect(res.body.user.email).toBe(testUser.email)
    })

    test("POST /api/auth/login - Invalid Credentials", async () => {
        await request(app)
            .post("/api/auth/register")
            .send(testUser)

        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: testUser.email,
                password: "wrongpassword"
            })

        expect(res.status).toBe(401)
        expect(res.body.message).toBe("Email or password is INVALID")
    })
})
