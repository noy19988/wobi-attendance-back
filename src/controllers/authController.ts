import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { User, Role } from "../models/userModel";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AttendanceRecord } from "../models/attendanceModel";


dotenv.config();

const usersPath = path.join(__dirname, "../data/users.json");
const SALT_ROUNDS = 10;







export const createUser = async (req: Request, res: Response) => {
  const { id, username, password, firstName, lastName, email, role } = req.body;

  if (!id || !username || !password || !firstName || !lastName || !email || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8") || "{}") as Record<string, User>;

  const existingUser = Object.values(usersData).find((u) => u.username === username || u.id === id);

  if (existingUser) {
    return res.status(409).json({ message: "Username or ID already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const newUser: User = {
    id,
    username,
    password: hashedPassword,
    firstName,
    lastName,
    email,
    role: role as Role,
  };

  usersData[username] = newUser;

  fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));

  return res.status(201).json({ message: "User created successfully", user: { ...newUser, password: undefined } });
};







export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8")) as Record<string, User>;
  const user = Object.values(usersData).find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.ACCESS_TOKEN_SECRET!,
    { expiresIn: "4h" }
  );

  return res.json({ token, role: user.role }); 
};






export const logout = (req: Request, res: Response) => {
  return res.status(200).json({ message: "Logged out successfully" });
};







export const updatePassword = async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required." });
  }

  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8")) as Record<string, User>;
  const user = usersData[username];

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ message: "Current password is incorrect." });
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.password = hashedNewPassword;
  usersData[username] = user;

  fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));

  return res.status(200).json({ message: "Password updated successfully." });
};




export const getCurrentUser = (req: AuthenticatedRequest, res: Response) => {
  const username = req.user?.username;
  console.log("Current user:", req.user); 

  if (!username) {
    console.log("User not authenticated");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8")) as Record<string, User>;

  const user = Object.values(usersData).find((user) => user.username === username);

  if (!user) {
    console.log("User not found:", username);
    return res.status(404).json({ message: "User not found" });
  }

  const userWithoutPassword = { ...user, password: undefined };
  console.log("User data returned:", userWithoutPassword); 

  return res.status(200).json(userWithoutPassword);
};






export const getAllUsers = (req: AuthenticatedRequest, res: Response) => {
  try {
    const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8")) as Record<string, User>;

    if (!req.query.userId) {
      const usersList = Object.values(usersData);

      const usersFormatted = usersList.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        email: user.email,
      }));

      return res.status(200).json({ users: usersFormatted });
    }

    const userId = req.query.userId as string;
    const user = Object.values(usersData).find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};








export const deleteUser = (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const usersData = JSON.parse(fs.readFileSync(usersPath, "utf-8")) as Record<string, User>;

    const username = Object.keys(usersData).find(key => usersData[key].id === userId);

    if (!username) {
      return res.status(404).json({ message: "User not found" });
    }

    const deletedUser = usersData[username];
    delete usersData[username];
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));

    const attendancePath = path.join(__dirname, "../data/attendance.json");
    const attendanceData = fs.existsSync(attendancePath)
      ? JSON.parse(fs.readFileSync(attendancePath, "utf-8"))
      : [];

    const updatedAttendance = attendanceData.filter((record: AttendanceRecord) => record.user.id !== userId);
    fs.writeFileSync(attendancePath, JSON.stringify(updatedAttendance, null, 2));

    return res.status(200).json({
      message: "User and all related shift records deleted successfully.",
      deletedUser: { ...deletedUser, password: undefined },
    });

  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({ message: "Failed to delete user" });
  }
};
