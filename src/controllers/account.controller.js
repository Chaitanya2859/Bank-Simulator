const accountModel = require("../models/account.model")

async function createAccountController(req, res) {
    const newAccount = await accountModel.create({
        user: req.user._id
    })
    res.status(201).json({
        account: newAccount
    })
}

async function getUserAccountsController(req, res) {
    const userAccounts = await accountModel.find({
        user: req.user._id
    })

    res.status(200).json({
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

module.exports = {
    createAccountController,
    getUserAccountsController,
    getAccountBalanceController
}