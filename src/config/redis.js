const { createClient } = require("redis")

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
const client = createClient({ url: redisUrl })

client.on("error", (err) => {
    console.error("Redis connection error:", err)
})

client.on("connect", () => {
    console.log("Redis connected successfully")
})

// Automatically connect client
if (process.env.NODE_ENV !== "test") {
    client.connect().catch((err) => {
        console.error("Redis initial error:", err)
    })
}

module.exports = client
