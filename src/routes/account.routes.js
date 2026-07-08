const express = require("express")
const authMiddleware = require("../middleware/auth.middleware")
const accountController = require("../controllers/account.controller")
const validate = require("../middleware/validation.middleware")
const { getBalanceSchema, getTransactionsSchema, getUserAccountsSchema } = require("../validation/account.validation")
const asyncHandler = require("../middleware/asyncHandler")

const router = express.Router()

/**
 * @swagger
 * /api/accounts:
 *   post:
 *     summary: Create new account
 *     tags: [Accounts]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created account successfully
 *       401:
 *         description: Unauthorized token access
 */
router.post("/", authMiddleware.authMiddleware, asyncHandler(accountController.createAccountController))

/**
 * @swagger
 * /api/accounts:
 *   get:
 *     summary: List user accounts
 *     tags: [Accounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page offset index
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Page limit count
 *     responses:
 *       200:
 *         description: Retrieved user accounts
 *       401:
 *         description: Unauthorized token access
 */
router.get("/", authMiddleware.authMiddleware, validate(getUserAccountsSchema), asyncHandler(accountController.getUserAccountsController))

/**
 * @swagger
 * /api/accounts/balance/{accountId}:
 *   get:
 *     summary: Get account balance
 *     tags: [Accounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target account ID
 *     responses:
 *       200:
 *         description: Retrieved account balance
 *       401:
 *         description: Unauthorized token access
 *       404:
 *         description: Account not found
 */
router.get("/balance/:accountId", authMiddleware.authMiddleware, validate(getBalanceSchema), asyncHandler(accountController.getAccountBalanceController))

/**
 * @swagger
 * /api/accounts/{accountId}/transactions:
 *   get:
 *     summary: Get transaction history
 *     tags: [Accounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target account ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page offset index
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Page limit count
 *     responses:
 *       200:
 *         description: Retrieved transaction history
 *       401:
 *         description: Unauthorized token access
 *       404:
 *         description: Account not found
 */
router.get("/:accountId/transactions", authMiddleware.authMiddleware, validate(getTransactionsSchema), asyncHandler(accountController.getAccountTransactionsController))
module.exports = router