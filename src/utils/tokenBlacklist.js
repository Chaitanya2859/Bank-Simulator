const redisClient = require("../config/redis")
const tokenBlackListModel = require("../models/blackList.model")

async function isTokenBlacklisted(token) {
    try {
        const cached = await redisClient.get(`blacklist:${token}`)
        if (cached === "true") {
            return true
        }
        // Fallback to Mongo
        const mongoHit = await tokenBlackListModel.findOne({ token }).lean()
        return !!mongoHit
    } catch (err) {
        console.error("Redis read failure:", err)
        // Fallback to Mongo
        const mongoHit = await tokenBlackListModel.findOne({ token }).lean()
        return !!mongoHit
    }
}

module.exports = { isTokenBlacklisted }
