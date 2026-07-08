const jwt = require("jsonwebtoken")
const userModel = require("../models/user.model")
const { isTokenBlacklisted } = require("../utils/tokenBlacklist")

// Verify auth token
async function verifyToken(req) {
    const authToken = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if (!authToken) {
        throw { status: 401, message: "Unauthorized access, token is missing" }
    }

    if (await isTokenBlacklisted(authToken)) {
        throw { status: 401, message: "Unauthorized access, token is invalid" }
    }

    try {
        return jwt.verify(authToken, process.env.JWT_SECRET)
    } catch (error) {
        throw { status: 401, message: "Unauthorized access, token is invalid" }
    }
}

async function authMiddleware(req, res, next) {
    try {
        const decodedToken = await verifyToken(req)
        const user = await userModel.findById(decodedToken.userId)

        if (!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found"
            })
        }

        req.user = user
        return next()
    } catch (err) {
        return res.status(err.status || 401).json({
            message: err.message
        })
    }
}

async function authSystemUserMiddleware(req, res, next) {
    try {
        const decodedToken = await verifyToken(req)
        const user = await userModel.findById(decodedToken.userId).select("+systemUser")

        if (!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found"
            })
        }

        if (!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden access, not a system user"
            })
        }

        req.user = user
        return next()
    } catch (err) {
        return res.status(err.status || 401).json({
            message: err.message
        })
    }
}

module.exports = {
    authMiddleware,
    authSystemUserMiddleware
}