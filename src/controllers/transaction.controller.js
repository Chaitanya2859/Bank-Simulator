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

    // 3. Check account status
    if (senderAccount.status !== "ACTIVE" || receiverAccount.status !== "ACTIVE") {
        return res.status(400).json({
            message: "Both fromAccount and toAccount must be ACTIVE to process transaction"
        })
    }

    // 4. Derive sender balance from ledger
    const currentBalance = await senderAccount.getBalance()

    if (currentBalance < amount) {
        return res.status(400).json({
            message: `Insufficient balance. Current balance is ${currentBalance}. Requested amount is ${amount}`
        })
    }

    let transaction

    try {
        const session = await mongoose.startSession()
        session.startTransaction()

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

        await new Promise(resolve => setTimeout(resolve, 15 * 1000))

        // 7. Create CREDIT ledger entry
        await ledgerModel.create([{
            account: toAccount,
            amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        // 8. Mark transaction COMPLETED
        await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session }
        )

        // 9. Commit MongoDB session
        await session.commitTransaction()
        session.endSession()
    } catch (error) {
        return res.status(400).json({
            message: "Transaction is Pending due to some issue, please retry after sometime"
        })
    }

    // 10. Send email notification
    await emailService.sendTransactionEmail(
        req.user.email,
        req.user.name,
        amount,
        toAccount
    )

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

    const systemAccount = await accountModel.findOne({
        user: req.user._id
    })

    if (!systemAccount) {
        return res.status(400).json({
            message: "System user account not found"
        })
    }

    const session = await mongoose.startSession()
    session.startTransaction()

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
}

module.exports = {
    createTransaction,
    createInitialFundsTransaction
}