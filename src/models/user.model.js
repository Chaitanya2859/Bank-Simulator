const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required for creating a user"],
        trim: true,
        lowercase: true,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid email address"],
        unique: [true, "Email already exists"]
    },
    name: {
        type: String,
        required: [true, "Name is required for creating an account"]
    },
    password: {
        type: String,
        required: [true, "Password is required for creating an account"],
        minlength: [6, "Password should contain at least 6 characters"],
        select: false
    },
    systemUser: {
        type: Boolean,
        default: false,
        immutable: true,
        select: false
    }
}, {
    timestamps: true
});

userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
});

userSchema.methods.comparePassword = async function (plainPassword) {
    return await bcrypt.compare(plainPassword, this.password);
};

const userModel = mongoose.model("user", userSchema);

module.exports = userModel;