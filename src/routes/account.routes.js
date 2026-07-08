const express = require("express")
const authMiddleware = require("../middleware/auth.middleware")
const accountController = require("../controllers/account.controller")
const validate = require("../middleware/validation.middleware")
const { getBalanceSchema, getTransactionsSchema, getUserAccountsSchema } = require("../validation/account.validation")
const asyncHandler = require("../middleware/asyncHandler")

const router = express.Router()
router.post("/", authMiddleware.authMiddleware, asyncHandler(accountController.createAccountController))
router.get("/", authMiddleware.authMiddleware, validate(getUserAccountsSchema), asyncHandler(accountController.getUserAccountsController))
router.get("/balance/:accountId", authMiddleware.authMiddleware, validate(getBalanceSchema), asyncHandler(accountController.getAccountBalanceController))
router.get("/:accountId/transactions", authMiddleware.authMiddleware, validate(getTransactionsSchema), asyncHandler(accountController.getAccountTransactionsController))
module.exports = router