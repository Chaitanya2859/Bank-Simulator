const accountModel = require("../models/account.model");

async function createAccountController(req, res) {
    const authenticatedUser = req.user;

    const newAccount = await accountModel.create({
        user: authenticatedUser._id
    });

    res.status(201).json({
        message: "Account created successfully",
        account: newAccount
    });
}

async function getUserAccountsController(req, res) {
    const userAccounts = await accountModel.find({
        user: req.user._id
    });

    res.status(200).json({
        message: "User accounts fetched successfully",
        accounts: userAccounts
    });
}

async function getAccountBalanceController(req, res) {
    const { accountId } = req.params;

    const userAccount = await accountModel.findOne({
        _id: accountId,
        user: req.user._id
    });

    if (!userAccount) {
        return res.status(404).json({
            message: "The requested account does not exist or you do not have access to it"
        });
    }

    const currentBalance = await userAccount.getBalance();

    res.status(200).json({
        message: "Account balance retrieved successfully",
        accountId: userAccount._id,
        balance: currentBalance
    });
}

module.exports = {
    createAccountController,
    getUserAccountsController,
    getAccountBalanceController
};