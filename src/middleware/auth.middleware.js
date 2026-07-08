const jwt = require("jsonwebtoken")

const userModel = require("../models/user.model")
const tokenBlackListModel = require("../models/blackList.model")

async function authMiddleware(req, res, next) {
    const authToken = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if (!authToken) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }

    const blacklistedToken = await tokenBlackListModel.findOne({
        token: authToken
    })

    if (blacklistedToken) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }

    try {
        const decodedToken = jwt.verify(authToken, process.env.JWT_SECRET)

        const user = await userModel.findById(decodedToken.userId)

        if (!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found"
            })
        }

        req.user = user

        return next()
    } catch (error) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }
}

async function authSystemUserMiddleware(req, res, next) {
    const authToken = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if (!authToken) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }

    const blacklistedToken = await tokenBlackListModel.findOne({
        token: authToken
    })

    if (blacklistedToken) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }

    try {
        const decodedToken = jwt.verify(authToken, process.env.JWT_SECRET)

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
    } catch (error) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }
}

module.exports = {
    authMiddleware,
    authSystemUserMiddleware
}