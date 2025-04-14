import express from "express";
import { verifyToken, isAdmin } from "../middleware/authMiddleware";
import { startShift, endShift, editRecord, getAttendanceSummary, getAllAttendanceRecords, getCurrentShift } from "../controllers/attendanceController"; // וודא ש-importת את getCurrentShift

const router = express.Router();

router.get("/all", verifyToken, isAdmin, getAllAttendanceRecords);
router.get("/summary", verifyToken, getAttendanceSummary);
router.get("/current", verifyToken, getCurrentShift);

router.post("/start", verifyToken, startShift);
router.post("/end", verifyToken, endShift);
router.put("/edit/:id", verifyToken, isAdmin, editRecord);

export default router;
