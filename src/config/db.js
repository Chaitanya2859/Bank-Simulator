const mongoose = require("mongoose")

function connectToDB(retries = 5, delay = 3000) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("server is connected to DB"))
        .catch(err => {
            console.error("MongoDB Error:", err)
            if (retries > 0) {
                // Retry connection attempt
                setTimeout(() => connectToDB(retries - 1, delay), delay)
            } else {
                process.exit(1)
            }
        })
}

module.exports = connectToDB