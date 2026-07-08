const express = require("express")
const cookieParser = require("cookie-parser")
const rateLimit = require("express-rate-limit")
const accountRouter = require("./routes/account.routes")
const authRouter = require("./routes/auth.routes")
const transactionRoutes = require("./routes/transaction.route")

const app = express()

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Fifteen minutes window
    max: 500, // Five hundred limit
    standardHeaders: true,
    legacyHeaders: false,
})

// Auth rate limiter
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Fifteen minutes window
    max: 100, // One hundred limit
    message: {
        status: "failed",
        message: "Too many requests. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
})

app.use(globalLimiter)
app.use(express.json())
app.use(cookieParser())

app.get("/", (req, res) => {
    res.send("LedgerFlow API is up and running")
})

app.use("/api/auth", authLimiter, authRouter)
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRoutes)

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Exception:", err)
    
    const statusCode = err.status || err.statusCode || 500
    res.status(statusCode).json({
        status: "error",
        message: err.message || "Internal Server Error"
    })
})

module.exports = app