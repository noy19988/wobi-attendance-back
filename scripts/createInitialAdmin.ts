import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { User } from "../src/models/userModel";

const usersPath = path.join(__dirname, "../src/data/users.json");
const SALT_ROUNDS = 10;

async function createAdmin() {
  const hashedPassword = await bcrypt.hash("admin123", SALT_ROUNDS);

  const admin: User = {
    id: "1234567890",
    username: "admin2",
    password: hashedPassword,
    firstName: "Admin",
    lastName: "User",
    email: "admin@company.com",
    role: "admin"
  };

  const usersData: Record<string, User> = { admin };
  fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
  console.log("Admin created!");
}

createAdmin();