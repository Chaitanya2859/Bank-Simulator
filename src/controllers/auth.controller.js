const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const emailService = require("../services/email.service");

async function userRegisterController(req, res) {
    const { email, password, name } = req.body;

    const existingUser = await userModel.findOne({
        email: email
    });

    if (existingUser) {
        return res.status(422).json({
            message: "An account with this email already exists",
            status: "failed"
        });
    }

    const newUser = await userModel.create({
        email,
        password,
        name
    });

    const authToken = jwt.sign(
        { userId: newUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    );

    res.cookie("token", authToken);

    res.status(201).json({
        message: "User registered successfully",
        user: {
            _id: newUser._id,
            email: newUser.email,
            name: newUser.name
        },
        token: authToken
    });

    await emailService.sendRegistrationEmail(newUser.email, newUser.name);
}

async function userLoginController(req, res) {
    const { email, password } = req.body;

    const existingUser = await userModel.findOne({
        email
    }).select("+password");

    if (!existingUser) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const isPasswordValid = await existingUser.comparePassword(password);

    if (!isPasswordValid) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const authToken = jwt.sign(
        { userId: existingUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    );

    res.cookie("token", authToken);

    res.status(200).json({
        message: "User logged in successfully",
        user: {
            _id: existingUser._id,
            email: existingUser.email,
            name: existingUser.name
        },
        token: authToken
    });
}

module.exports = {
    userRegisterController,
    userLoginController
};