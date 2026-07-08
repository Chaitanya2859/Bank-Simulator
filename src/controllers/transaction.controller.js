const mongoose = require("mongoose")

const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const transactionModel = require("../models/transaction.model")
const emailService = require("../services/email.service")

async function createTransaction(req, res) {
    // Validate request payload
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "fromAccount, toAccount, amount and idempotencyKey are required"
        })
    }

    if (fromAccount === toAccount) {
        return res.status(400).json({
            message: "Cannot transfer funds to the same account"
        })
    }

    const senderAccount = await accountModel.findOne({ _id: fromAccount, user: req.user._id })
    const receiverAccount = await accountModel.findOne({ _id: toAccount })

    if (!senderAccount || !receiverAccount) {
        return res.status(400).json({
            message: "Invalid fromAccount or toAccount, or you do not own the fromAccount"
        })
    }

    // Check idempotency key
    const existingTransaction = await transactionModel.findOne({
        idempotencyKey
    })

    if (existingTransaction) {
        if (existingTransaction.status === "COMPLETED") {
            return res.status(200).json({
                message: "Transaction already processed",
                transaction: existingTransaction
            })
        }

        if (existingTransaction.status === "PENDING") {
            return res.status(200).json({
                message: "Transaction is still processing"
            })
        }

        if (existingTransaction.status === "FAILED") {
            return res.status(400).json({
                message: "Transaction processing failed. Please retry using a new idempotencyKey."
            })
        }

        if (existingTransaction.status === "REVERSED") {
            return res.status(400).json({
                message: "Transaction was reversed. Please retry using a new idempotencyKey."
            })
        }
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    let transaction

    try {
        let senderAccountLocked
        let receiverAccountLocked

        // Prevent transaction deadlocks
        if (String(fromAccount) < String(toAccount)) {
            senderAccountLocked = await accountModel.findOneAndUpdate(
                { _id: fromAccount, status: "ACTIVE" },
                { $set: { updatedAt: new Date() } },
                { session, new: true }
            )
            receiverAccountLocked = await accountModel.findOne({
                _id: toAccount,
                status: "ACTIVE"
            }).session(session)
        } else {
            receiverAccountLocked = await accountModel.findOne({
                _id: toAccount,
                status: "ACTIVE"
            }).session(session)
            senderAccountLocked = await accountModel.findOneAndUpdate(
                { _id: fromAccount, status: "ACTIVE" },
                { $set: { updatedAt: new Date() } },
                { session, new: true }
            )
        }

        if (!senderAccountLocked) {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).json({
                message: "Sender account is invalid or not ACTIVE"
            })
        }

        if (!receiverAccountLocked) {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).json({
                message: "Receiver account is invalid or not ACTIVE"
            })
        }

        // Derive sender balance
        const currentBalance = await senderAccountLocked.getBalance(session)

        if (currentBalance < amount) {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).json({
                message: `Insufficient balance. Current balance is ${currentBalance}. Requested amount is ${amount}`
            })
        }

        // Create pending transaction
        transaction = (
            await transactionModel.create([{
                fromAccount,
                toAccount,
                amount,
                idempotencyKey,
                status: "PENDING"
            }], { session })
        )[0]

        // Create debit entry
        await ledgerModel.create([{
            account: fromAccount,
            amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session })

        // Create credit entry
        await ledgerModel.create([{
            account: toAccount,
            amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        // Mark transaction completed
        transaction = await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session, new: true }
        )

        // Commit database transaction
        await session.commitTransaction()
        session.endSession()
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction()
        }
        session.endSession()

        // Record transaction failure
        let failedTransaction
        try {
            if (transaction && transaction._id) {
                failedTransaction = await transactionModel.findByIdAndUpdate(
                    transaction._id,
                    { status: "FAILED" },
                    { new: true }
                )
            }
            if (!failedTransaction) {
                failedTransaction = await transactionModel.create({
                    fromAccount,
                    toAccount,
                    amount,
                    idempotencyKey,
                    status: "FAILED"
                })
            }
        } catch (dbError) {
            console.error("Failed to save failed transaction state:", dbError)
        }

        // Email failure notification
        try {
            await emailService.sendTransactionFailureEmail(
                req.user.email,
                req.user.name,
                amount,
                toAccount
            )
        } catch (emailError) {
            console.error("Failed to send transaction failure email:", emailError)
        }

        return res.status(400).json({
            message: "Transaction failed. Please retry after some time.",
            transaction: failedTransaction
        })
    }

    // Email success notification
    try {
        await emailService.sendTransactionEmail(
            req.user.email,
            req.user.name,
            amount,
            toAccount
        )
    } catch (emailError) {
        console.error("Failed to send transaction success email:", emailError)
    }

    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction
    })
}

async function createInitialFundsTransaction(req, res) {
    const { toAccount, amount, idempotencyKey } = req.body

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "toAccount, amount and idempotencyKey are required"
        })
    }

    const receiverAccount = await accountModel.findOne({ _id: toAccount })

    if (!receiverAccount) {
        return res.status(400).json({
            message: "Invalid toAccount"
        })
    }

    const existingTransaction = await transactionModel.findOne({ idempotencyKey })

    if (existingTransaction) {
        if (existingTransaction.status === "COMPLETED") {
            return res.status(200).json({
                message: "Transaction already processed",
                transaction: existingTransaction
            })
        }
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        // Find reserve account
        let reserveAccount = await accountModel.findOne({ systemReserve: true }).select("+systemReserve").session(session)

        if (!reserveAccount) {
            // Initialize reserve account
            reserveAccount = (await accountModel.create([{
                user: req.user._id,
                currency: "INR",
                status: "ACTIVE",
                systemReserve: true
            }], { session }))[0]
        }

        // Create transaction document
        const [transaction] = await transactionModel.create([{
            fromAccount: reserveAccount._id,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], { session })

        await ledgerModel.create([{
            account: reserveAccount._id,
            amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session })

        await ledgerModel.create([{
            account: toAccount,
            amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        const completedTransaction = await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session, returnDocument: "after" }
        )

        await session.commitTransaction()
        session.endSession()

        return res.status(201).json({
            message: "Initial funds transaction completed successfully",
            transaction: completedTransaction
        })
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction()
        }
        session.endSession()

        return res.status(400).json({
            message: "Failed to process initial funds transaction.",
            error: error.message
        })
    }
}

module.exports = {
    createTransaction,
    createInitialFundsTransaction
}