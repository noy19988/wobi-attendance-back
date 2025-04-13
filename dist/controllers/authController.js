"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePassword = exports.logout = exports.login = exports.createUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcrypt_1 = __importDefault(require("bcrypt"));
dotenv_1.default.config();
const usersPath = path_1.default.join(__dirname, "../data/users.json");
const SALT_ROUNDS = 10;
const createUser = async (req, res) => {
    const { id, username, password, firstName, lastName, email, role } = req.body;
    if (!id || !username || !password || !firstName || !lastName || !email || !role) {
        return res.status(400).json({ message: "All fields are required" });
    }
    if (!["admin", "user"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
    }
    const usersData = JSON.parse(fs_1.default.readFileSync(usersPath, "utf-8") || "{}");
    const existingUser = Object.values(usersData).find((u) => u.username === username || u.id === id);
    if (existingUser) {
        return res.status(409).json({ message: "Username or ID already exists" });
    }
    const hashedPassword = await bcrypt_1.default.hash(password, SALT_ROUNDS);
    const newUser = {
        id,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        email,
        role: role,
    };
    usersData[username] = newUser;
    fs_1.default.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
    return res.status(201).json({ message: "User created successfully", user: { ...newUser, password: undefined } });
};
exports.createUser = createUser;
const login = async (req, res) => {
    const { username, password } = req.body;
    const usersData = JSON.parse(fs_1.default.readFileSync(usersPath, "utf-8"));
    const user = Object.values(usersData).find((u) => u.username === username);
    if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
    }
    const passwordMatch = await bcrypt_1.default.compare(password, user.password);
    if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid username or password" });
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
    return res.json({ token });
};
exports.login = login;
const logout = (req, res) => {
    return res.status(200).json({ message: "Logged out successfully" });
};
exports.logout = logout;
const updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required." });
    }
    const username = req.user?.username;
    if (!username) {
        return res.status(401).json({ message: "Unauthorized." });
    }
    const usersData = JSON.parse(fs_1.default.readFileSync(usersPath, "utf-8"));
    const user = usersData[username];
    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }
    const passwordMatch = await bcrypt_1.default.compare(currentPassword, user.password);
    if (!passwordMatch) {
        return res.status(401).json({ message: "Current password is incorrect." });
    }
    const hashedNewPassword = await bcrypt_1.default.hash(newPassword, SALT_ROUNDS);
    user.password = hashedNewPassword;
    usersData[username] = user;
    fs_1.default.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
    return res.status(200).json({ message: "Password updated successfully." });
};
exports.updatePassword = updatePassword;
