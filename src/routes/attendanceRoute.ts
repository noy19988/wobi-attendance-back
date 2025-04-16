import express from "express";
import { verifyToken, isAdmin } from "../middleware/authMiddleware";
import { startShift, endShift, getAttendanceSummary, getCurrentShift,editShiftRecord,deleteShiftRecord } from "../controllers/attendanceController"; // וודא ש-importת את getCurrentShift

const router = express.Router();

router.get("/all", verifyToken, isAdmin);
router.get("/summary", verifyToken, getAttendanceSummary);
router.get("/current", verifyToken, getCurrentShift);

router.post("/start", verifyToken, startShift);
router.post("/end", verifyToken, endShift);
router.put("/edit/:id", verifyToken, isAdmin);

router.put("/edit/:id", verifyToken, isAdmin, editShiftRecord);

router.delete("/delete/:id", verifyToken, isAdmin, deleteShiftRecord);

export default router;
