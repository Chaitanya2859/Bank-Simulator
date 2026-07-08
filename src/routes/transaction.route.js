const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const transactionController = require("../controllers/transaction.controller")
const validate = require("../middleware/validation.middleware")
const { createTransactionSchema, createInitialFundsSchema } = require("../validation/transaction.validation")
const asyncHandler = require("../middleware/asyncHandler")

const transactionRoutes = Router();
transactionRoutes.post("/", authMiddleware.authMiddleware, validate(createTransactionSchema), asyncHandler(transactionController.createTransaction))
transactionRoutes.post("/system/initial-funds", authMiddleware.authSystemUserMiddleware, validate(createInitialFundsSchema), asyncHandler(transactionController.createInitialFundsTransaction))

module.exports = transactionRoutes;