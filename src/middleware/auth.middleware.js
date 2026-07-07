const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");

async function authMiddleware(req, res, next) {
    const authToken =
        req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!authToken) {
        return res.status(401).json({
            message: "Authentication token is missing"
        });
    }

    try {
        const decodedToken = jwt.verify(authToken, process.env.JWT_SECRET);

        const authenticatedUser = await userModel.findById(decodedToken.userId);

        if (!authenticatedUser) {
            return res.status(401).json({
                message: "User associated with this token was not found"
            });
        }

        req.user = authenticatedUser;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Authentication token is invalid or has expired"
        });
    }
}

async function authSystemUserMiddleware(req, res, next) {
    const authToken =
        req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!authToken) {
        return res.status(401).json({
            message: "Authentication token is missing"
        });
    }

    try {
        const decodedToken = jwt.verify(authToken, process.env.JWT_SECRET);

        const authenticatedUser = await userModel
            .findById(decodedToken.userId)
            .select("+systemUser");

        if (!authenticatedUser) {
            return res.status(401).json({
                message: "User associated with this token was not found"
            });
        }

        if (!authenticatedUser.systemUser) {
            return res.status(403).json({
                message: "Access denied. System user privileges are required"
            });
        }

        req.user = authenticatedUser;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Authentication token is invalid or has expired"
        });
    }
}

module.exports = {
    authMiddleware,
    authSystemUserMiddleware
};