const { z } = require("zod")

const getBalanceSchema = {
    params: z.object({
        accountId: z.string({
            required_error: "Account ID is required"
        }).regex(/^[0-9a-fA-F]{24}$/, "Invalid Account ID format (must be a 24-character hex string)")
    })
}

const getTransactionsSchema = {
    params: z.object({
        accountId: z.string({
            required_error: "Account ID is required"
        }).regex(/^[0-9a-fA-F]{24}$/, "Invalid Account ID format (must be a 24-character hex string)")
    }),
    query: z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1).pipe(z.number().int().positive().optional()),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 10).pipe(z.number().int().positive().optional())
    })
}

const getUserAccountsSchema = {
    query: z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1).pipe(z.number().int().positive().optional()),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 10).pipe(z.number().int().positive().optional())
    })
}

module.exports = {
    getBalanceSchema,
    getTransactionsSchema,
    getUserAccountsSchema
}
