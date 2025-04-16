"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const authRoute_1 = __importDefault(require("./routes/authRoute"));
const attendanceRoute_1 = __importDefault(require("./routes/attendanceRoute"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "http://localhost:5173",
    credentials: true,
}));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use("/auth", authRoute_1.default);
app.use("/attendance", attendanceRoute_1.default);
const verifyDataFiles = () => {
    const dataFiles = ["users.json", "attendance.json"];
    const dataDir = path_1.default.join(__dirname, "data");
    for (const fileName of dataFiles) {
        const filePath = path_1.default.join(dataDir, fileName);
        if (!fs_1.default.existsSync(filePath)) {
            console.error(`Missing file: ${filePath}`);
            return false;
        }
        try {
            const fileContent = fs_1.default.readFileSync(filePath, "utf-8");
            JSON.parse(fileContent);
        }
        catch (err) {
            console.error(`Error parsing ${fileName}:`, err);
            return false;
        }
    }
    return true;
};
const initApp = () => {
    return new Promise((resolve, reject) => {
        if (!verifyDataFiles()) {
            reject("One or more required data files are missing or invalid.");
        }
        else {
            console.log("All required data files are valid.");
            resolve(app);
        }
    });
};
exports.default = initApp;
