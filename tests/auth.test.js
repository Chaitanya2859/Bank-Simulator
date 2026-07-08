const request = require("supertest")
const mongoose = require("mongoose")
const { MongoMemoryReplSet } = require("mongodb-memory-server")
const app = require("../src/app")
const userModel = require("../src/models/user.model")
const tokenBlackListModel = require("../src/models/blackList.model")

// Mock email service to prevent attempting to connect to SMTP
jest.mock("../src/services/email.service.js", () => ({
    sendRegistrationEmail:      jest.fn().mockResolvedValue(true),
    sendTransactionEmail:       jest.fn().mockResolvedValue(true),
    sendTransactionFailureEmail: jest.fn().mockResolvedValue(true)
}))

// Mock Redis storage
global.mockRedisStore = global.mockRedisStore || new Map()
jest.mock("../src/config/redis.js", () => ({
    get: jest.fn().mockImplementation(async (key) => global.mockRedisStore.get(key) || null),
    setEx: jest.fn().mockImplementation(async (key, ttl, value) => {
        global.mockRedisStore.set(key, value)
        return "OK"
    }),
    connect: jest.fn().mockResolvedValue(true)
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
    await tokenBlackListModel.deleteMany({})
    global.mockRedisStore.clear()
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

    const parseCookieToken = (res) => {
        const cookies = res.headers["set-cookie"]
        if (!cookies) return null
        const tokenCookie = cookies.find(c => c.startsWith("token="))
        if (!tokenCookie) return null
        return tokenCookie.split(";")[0].replace("token=", "")
    }

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

    test("authMiddleware falls back to Mongo when Redis read fails", async () => {
        const redisClient = require("../src/config/redis")
        
        await request(app).post("/api/auth/register").send(testUser)
        const loginRes = await request(app).post("/api/auth/login").send({
            email: testUser.email,
            password: testUser.password
        })
        const token = parseCookieToken(loginRes)

        // Mute console errors
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

        redisClient.setEx.mockRejectedValueOnce(new Error("Redis write failure"))
        await request(app)
            .post("/api/auth/logout")
            .set("Authorization", `Bearer ${token}`)
            .send()

        redisClient.get.mockRejectedValueOnce(new Error("Redis connection lost"))
        const res = await request(app)
            .get("/api/accounts")
            .set("Authorization", `Bearer ${token}`)
            .send()

        // Restore console errors
        consoleSpy.mockRestore()

        expect(res.status).toBe(401)
    })
})
