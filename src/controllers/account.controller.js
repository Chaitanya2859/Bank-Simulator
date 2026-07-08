const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")

async function createAccountController(req, res) {
    const newAccount = await accountModel.create({
        user: req.user._id
    })
    res.status(201).json({
        account: newAccount
    })
}

async function getUserAccountsController(req, res) {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const total = await accountModel.countDocuments({ user: req.user._id })
    const userAccounts = await accountModel.find({
        user: req.user._id
    })
    .skip(skip)
    .limit(limit)

    res.status(200).json({
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalAccounts: total,
        accounts: userAccounts
    })
}

async function getAccountBalanceController(req, res) {
    const { accountId } = req.params

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id
    })

    if (!account) {
        return res.status(404).json({
            message: "Account not found"
        })
    }

    const accountBalance = await account.getBalance()

    res.status(200).json({
        accountId: account._id,
        balance: accountBalance
    })
}

async function getAccountTransactionsController(req, res) {
    const { accountId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id
    })

    if (!account) {
        return res.status(404).json({
            message: "Account not found or access denied"
        })
    }

    const total = await ledgerModel.countDocuments({ account: accountId })
    const ledgerEntries = await ledgerModel.find({ account: accountId })
        .populate("transaction")
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)

    res.status(200).json({
        accountId,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalEntries: total,
        transactions: ledgerEntries
    })
}

module.exports = {
    createAccountController,
    getUserAccountsController,
    getAccountBalanceController,
    getAccountTransactionsController
}