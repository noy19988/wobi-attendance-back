"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const authController_1 = require("../controllers/authController");
const router = express_1.default.Router();
router.get("/me", authMiddleware_1.verifyToken, authController_1.getCurrentUser);
router.put("/update-password", authMiddleware_1.verifyToken, authController_1.updatePassword);
router.post("/login", authController_1.login);
router.post("/logout", authMiddleware_1.verifyToken, authController_1.logout);
router.post("/create", authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, authController_1.createUser);
router.get("/users", authMiddleware_1.verifyToken, authController_1.getAllUsers);
exports.default = router;
