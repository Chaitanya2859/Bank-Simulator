const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const transactionController = require("../controllers/transaction.controller")
const validate = require("../middleware/validation.middleware")
const { createTransactionSchema, createInitialFundsSchema } = require("../validation/transaction.validation")
const asyncHandler = require("../middleware/asyncHandler")

const transactionRoutes = Router();

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Transfer funds between accounts
 *     tags: [Transactions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromAccount
 *               - toAccount
 *               - amount
 *               - idempotencyKey
 *             properties:
 *               fromAccount:
 *                 type: string
 *               toAccount:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               idempotencyKey:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transaction completed successfully
 *       400:
 *         description: Validation failed or insufficient balance
 *       401:
 *         description: Unauthorized token access
 */
transactionRoutes.post("/", authMiddleware.authMiddleware, validate(createTransactionSchema), asyncHandler(transactionController.createTransaction))

/**
 * @swagger
 * /api/transactions/system/initial-funds:
 *   post:
 *     summary: Seed initial funds
 *     tags: [Transactions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toAccount
 *               - amount
 *               - idempotencyKey
 *             properties:
 *               toAccount:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               idempotencyKey:
 *                 type: string
 *     responses:
 *       201:
 *         description: Funds seeded successfully
 *       400:
 *         description: Seeding failed
 *       401:
 *         description: Unauthorized token access
 *       403:
 *         description: Forbidden not system user
 */
transactionRoutes.post("/system/initial-funds", authMiddleware.authSystemUserMiddleware, validate(createInitialFundsSchema), asyncHandler(transactionController.createInitialFundsTransaction))

module.exports = transactionRoutes;