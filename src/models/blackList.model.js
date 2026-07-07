const mongoose = require("mongoose")

const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [true, "Blacklisted token is required"],
        unique: [true, "Token has already been blacklisted"]
    }
}, {
    timestamps: true
})

tokenBlacklistSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 60 * 24 * 3 }
)

const tokenBlackListModel = mongoose.model("tokenBlackList", tokenBlacklistSchema)

module.exports = tokenBlackListModel