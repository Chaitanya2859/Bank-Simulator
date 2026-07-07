const mongoose = require("mongoose")

const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const transactionModel = require("../models/transaction.model")
const emailService = require("../services/email.service")

async function createTransaction(req, res) {
    // 1. Validate request
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "FromAccount, toAccount, amount and idempotencyKey are required"
        })
    }

    const senderAccount = await accountModel.findOne({ _id: fromAccount })
    const receiverAccount = await accountModel.findOne({ _id: toAccount })

    if (!senderAccount || !receiverAccount) {
        return res.status(400).json({
            message: "Invalid fromAccount or toAccount"
        })
    }

    // 2. Validate idempotency key
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
            return res.status(500).json({
                message: "Transaction processing failed, please retry"
            })
        }

        if (existingTransaction.status === "REVERSED") {
            return res.status(500).json({
                message: "Transaction was reversed, please retry"
            })
        }
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    let transaction

    try {
        // 3. Acquire a write lock on the sender account by updating a timestamp to prevent race conditions
        const senderAccountLocked = await accountModel.findOneAndUpdate(
            { _id: fromAccount, status: "ACTIVE" },
            { $set: { updatedAt: new Date() } },
            { session, new: true }
        )

        if (!senderAccountLocked) {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).json({
                message: "Sender account is invalid or not ACTIVE"
            })
        }

        // Verify receiver account is ACTIVE under the session
        const receiverAccountLocked = await accountModel.findOne({
            _id: toAccount,
            status: "ACTIVE"
        }).session(session)

        if (!receiverAccountLocked) {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).json({
                message: "Receiver account is invalid or not ACTIVE"
            })
        }

        // 4. Derive sender balance from ledger under the transaction session
        const currentBalance = await senderAccountLocked.getBalance(session)

        if (currentBalance < amount) {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).json({
                message: `Insufficient balance. Current balance is ${currentBalance}. Requested amount is ${amount}`
            })
        }

        // 5. Create transaction (PENDING)
        transaction = (
            await transactionModel.create([{
                fromAccount,
                toAccount,
                amount,
                idempotencyKey,
                status: "PENDING"
            }], { session })
        )[0]

        // 6. Create DEBIT ledger entry
        await ledgerModel.create([{
            account: fromAccount,
            amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session })

        // 7. Create CREDIT ledger entry
        await ledgerModel.create([{
            account: toAccount,
            amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        // 8. Mark transaction COMPLETED
        transaction = await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session, new: true }
        )

        // 9. Commit MongoDB session
        await session.commitTransaction()
        session.endSession()
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction()
        }
        session.endSession()

        // Create or update transaction record to FAILED state outside the transaction session
        let failedTransaction
        try {
            if (transaction && transaction._id) {
                failedTransaction = await transactionModel.findByIdAndUpdate(
                    transaction._id,
                    { status: "FAILED" },
                    { new: true }
                )
            } else {
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

        // Send email notification of failure
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

    // 10. Send email notification
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
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        let systemAccount = await accountModel.findOne({
            user: req.user._id
        }).session(session)

        // Automatically create system account if it doesn't exist yet
        if (!systemAccount) {
            systemAccount = (await accountModel.create([{
                user: req.user._id,
                currency: "INR",
                status: "ACTIVE"
            }], { session }))[0]
        }

        const transaction = new transactionModel({
            fromAccount: systemAccount._id,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        })

        await ledgerModel.create([{
            account: systemAccount._id,
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

        transaction.status = "COMPLETED"
        await transaction.save({ session })

        await session.commitTransaction()
        session.endSession()

        return res.status(201).json({
            message: "Initial funds transaction completed successfully",
            transaction
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