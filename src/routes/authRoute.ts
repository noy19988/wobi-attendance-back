import express from "express";
import { verifyToken, isAdmin } from "../middleware/authMiddleware";
import { createUser , logout, login, updatePassword, getCurrentUser, getAllUsers,deleteUser} from "../controllers/authController";

const router = express.Router();

router.get("/me", verifyToken, getCurrentUser);
router.put("/update-password", verifyToken, updatePassword);
router.post("/login", login);
router.post("/logout", verifyToken, logout);

router.post("/create", verifyToken, isAdmin, createUser);

router.get("/users", verifyToken, getAllUsers);
router.delete("/delete/:id", verifyToken, isAdmin, deleteUser);


export default router;