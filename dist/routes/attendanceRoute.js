"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const attendanceController_1 = require("../controllers/attendanceController");
const router = express_1.default.Router();
router.get("/all", authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, attendanceController_1.getAllAttendanceRecords);
router.get("/summary", authMiddleware_1.verifyToken, attendanceController_1.getAttendanceSummary);
router.post("/start", authMiddleware_1.verifyToken, attendanceController_1.startShift);
router.post("/end", authMiddleware_1.verifyToken, attendanceController_1.endShift);
router.put("/edit/:id", authMiddleware_1.verifyToken, authMiddleware_1.isAdmin, attendanceController_1.editRecord);
exports.default = router;
