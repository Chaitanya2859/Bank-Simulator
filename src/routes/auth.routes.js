const express = require("express")
const authController = require("../controllers/auth.controller")
const validate = require("../middleware/validation.middleware")
const { registerSchema, loginSchema } = require("../validation/auth.validation")
const asyncHandler = require("../middleware/asyncHandler")
const router = express.Router()

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minimum: 6
 *     responses:
 *       201:
 *         description: Registered successfully
 *       400:
 *         description: Invalid input payload
 *       422:
 *         description: User already exists
 */
router.post("/register", validate(registerSchema), asyncHandler(authController.userRegisterController))

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login existing user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       400:
 *         description: Invalid input payload
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", validate(loginSchema), asyncHandler(authController.userLoginController))

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout current user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", asyncHandler(authController.userLogoutController))
module.exports = router