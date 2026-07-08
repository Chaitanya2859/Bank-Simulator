const swaggerJSDoc = require("swagger-jsdoc")

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "LedgerFlow API",
            version: "1.0.0",
            description: "Double-entry ledger simulation API"
        },
        servers: [
            {
                url: "http://localhost:4000",
                description: "Local development server"
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        }
    },
    apis: ["./src/routes/*.js"] // Parse route annotations
}

const swaggerSpec = swaggerJSDoc(options)

module.exports = swaggerSpec
