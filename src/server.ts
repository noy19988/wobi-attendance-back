import express, { Express } from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import authRoutes from "./routes/authRoute";
import attendanceRoutes from "./routes/attendanceRoute";
import fs from "fs";
import path from "path";

dotenv.config();
const app: Express = express();

app.use(
  cors({
    origin: "http://localhost:5173", 
    credentials: true, 
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/auth", authRoutes);
app.use("/attendance", attendanceRoutes);


const verifyDataFiles = (): boolean => {
  const dataFiles = ["users.json", "attendance.json"];
  const dataDir = path.join(__dirname, "data");

  for (const fileName of dataFiles) {
    const filePath = path.join(dataDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.error(`Missing file: ${filePath}`);
      return false;
    }

    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      JSON.parse(fileContent);
    } catch (err) {
      console.error(`Error parsing ${fileName}:`, err);
      return false;
    }
  }

  return true;
};

const initApp = (): Promise<Express> => {
  return new Promise((resolve, reject) => {
    if (!verifyDataFiles()) {
      reject("One or more required data files are missing or invalid.");
    } else {
      console.log("All required data files are valid.");
      resolve(app);
    }
  });
};

export default initApp;
