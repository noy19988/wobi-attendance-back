import express from "express";
import { verifyToken, isAdmin } from "../middleware/authMiddleware";
import { startShift, endShift, editRecord, getAttendanceSummary, getAllAttendanceRecords} from "../controllers/attendanceController";

const router = express.Router();
router.get("/all", verifyToken, isAdmin, getAllAttendanceRecords);
router.get("/summary", verifyToken, getAttendanceSummary);
router.post("/start", verifyToken, startShift);
router.post("/end", verifyToken, endShift);
router.put("/edit/:id", verifyToken, isAdmin, editRecord);

export default router;
