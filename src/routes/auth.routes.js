const express = require("express")
const authController = require("../controllers/auth.controller")
const validate = require("../middleware/validation.middleware")
const { registerSchema, loginSchema } = require("../validation/auth.validation")
const asyncHandler = require("../middleware/asyncHandler")
const router = express.Router()

router.post("/register", validate(registerSchema), asyncHandler(authController.userRegisterController))
router.post("/login", validate(loginSchema), asyncHandler(authController.userLoginController))
router.post("/logout", asyncHandler(authController.userLogoutController))
module.exports = router