import express from "express";
import { verifyToken, isAdmin } from "../middleware/authMiddleware";
import { createUser , logout, login, updatePassword} from "../controllers/authController";

const router = express.Router();

router.put("/update-password", verifyToken, updatePassword);
router.post("/login", login);
router.post("/logout", verifyToken, logout);

router.post("/create", verifyToken, isAdmin, createUser);


export default router;