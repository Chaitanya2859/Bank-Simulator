const { ZodError } = require("zod")

const validate = (schema) => (req, res, next) => {
    try {
        if (schema.body) {
            req.body = schema.body.parse(req.body)
        }
        if (schema.query) {
            req.query = schema.query.parse(req.query)
        }
        if (schema.params) {
            req.params = schema.params.parse(req.params)
        }
        next()
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                status: "failed",
                message: "Validation failed",
                errors: error.issues.map(err => ({
                    field: err.path.join("."),
                    message: err.message
                }))
            })
        }
        next(error)
    }
}

module.exports = validate
