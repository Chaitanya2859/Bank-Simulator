const { createClient } = require("redis")

const redisUrl = process.env.REDIS_URL
let client = null

if (redisUrl) {
    client = createClient({ url: redisUrl })

    client.on("error", (err) => {
        console.error("Redis connection error:", err)
    })

    client.on("connect", () => {
        console.log("Redis connected successfully")
    })

    // Establish Redis connection
    if (process.env.NODE_ENV !== "test") {
        client.connect().catch((err) => {
            console.error("Redis initial error:", err)
        })
    }
}

module.exports = client
