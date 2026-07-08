const { z } = require("zod")

const createTransactionSchema = {
    body: z.object({
        fromAccount: z.string({
            required_error: "fromAccount is required"
        }).regex(/^[0-9a-fA-F]{24}$/, "Invalid fromAccount ID format"),
        toAccount: z.string({
            required_error: "toAccount is required"
        }).regex(/^[0-9a-fA-F]{24}$/, "Invalid toAccount ID format"),
        amount: z.number({
            required_error: "Amount is required"
        }).positive("Amount must be a positive number").finite(),
        idempotencyKey: z.string({
            required_error: "idempotencyKey is required"
        }).min(1, "idempotencyKey cannot be empty").max(100)
    }).strict()
}

const createInitialFundsSchema = {
    body: z.object({
        toAccount: z.string({
            required_error: "toAccount is required"
        }).regex(/^[0-9a-fA-F]{24}$/, "Invalid toAccount ID format"),
        amount: z.number({
            required_error: "Amount is required"
        }).positive("Amount must be a positive number").finite(),
        idempotencyKey: z.string({
            required_error: "idempotencyKey is required"
        }).min(1, "idempotencyKey cannot be empty").max(100)
    }).strict()
}

module.exports = {
    createTransactionSchema,
    createInitialFundsSchema
}
