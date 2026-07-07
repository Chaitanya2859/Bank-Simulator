const jwt = require("jsonwebtoken")
const userModel = require("../models/user.model")
const tokenBlackListModel = require("../models/blackList.model")
const emailService = require("../services/email.service")

async function userRegisterController(req, res) {
    const { name, email, password } = req.body
    const existingUser = await userModel.findOne({ email })
    if (existingUser) {
        return res.status(422).json({
            status: "failed",
            message: "User already exists with email."
        })
    }

    const newUser = await userModel.create({ name, email, password })
    const authToken = jwt.sign(
        { userId: newUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    )

    res.cookie("token", authToken)
    res.status(201).json({
        user: {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email
        },
        token: authToken
    })

    await emailService.sendRegistrationEmail(newUser.email, newUser.name)
}

async function userLoginController(req, res) {
    const { email, password } = req.body
    const existingUser = await userModel.findOne({ email }).select("+password")
    if (!existingUser) {
        return res.status(401).json({
            message: "Email or password is INVALID"
        })
    }

    const isPasswordValid = await existingUser.comparePassword(password)

    if (!isPasswordValid) {
        return res.status(401).json({
            message: "Email or password is INVALID"
        })
    }

    const authToken = jwt.sign(
        { userId: existingUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    )
    res.cookie("token", authToken)
    res.status(200).json({
        user: {
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email
        },
        token: authToken
    })
}

async function userLogoutController(req, res) {
    const authToken = req.cookies.token || req.headers.authorization?.split(" ")[1]
    if (!authToken) {
        return res.status(200).json({
            message: "User logged out successfully"
        })
    }

    await tokenBlackListModel.create({ token: authToken })
    res.clearCookie("token")
    res.status(200).json({
        message: "User logged out successfully"
    })
}

module.exports = {
    userRegisterController,
    userLoginController,
    userLogoutController
}