import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export interface JwtPayload {
  id: string;
  username: string;
  role: "user" | "admin";
}


export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  console.log("Token received: ", token);

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const secret = process.env.ACCESS_TOKEN_SECRET!;
    const decoded = jwt.verify(token, secret) as JwtPayload;
    console.log(decoded); 
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    res.status(403).json({ message: "Invalid token." });
  }
};

export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  if (user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  next();
};
