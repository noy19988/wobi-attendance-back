"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAttendanceRecords = exports.getAttendanceSummary = exports.editRecord = exports.endShift = exports.startShift = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
const attendancePath = path_1.default.join(__dirname, "../data/attendance.json");
const loadAttendance = () => {
    if (!fs_1.default.existsSync(attendancePath))
        return [];
    const data = fs_1.default.readFileSync(attendancePath, "utf-8");
    return data.trim() ? JSON.parse(data) : [];
};
const saveAttendance = (records) => {
    fs_1.default.writeFileSync(attendancePath, JSON.stringify(records, null, 2));
};
const getGermanTime = async () => {
    const response = await axios_1.default.get("https://timeapi.io/api/Time/current/zone?timeZone=Europe/Berlin");
    return response.data.dateTime;
};
const startShift = async (req, res) => {
    const user = req.user;
    try {
        const timestamp = await getGermanTime();
        const records = loadAttendance();
        const lastIn = records
            .filter(r => r.user.id === user.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .find(r => r.type === "in");
        const lastOut = records
            .filter(r => r.user.id === user.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .find(r => r.type === "out");
        if (lastIn && (!lastOut || new Date(lastIn.timestamp) > new Date(lastOut.timestamp))) {
            return res.status(400).json({ message: "You already have an open shift." });
        }
        const newRecord = {
            id: (0, uuid_1.v4)(),
            user,
            type: "in",
            timestamp,
        };
        records.push(newRecord);
        saveAttendance(records);
        res.status(201).json({ message: "Shift started", record: newRecord });
    }
    catch (err) {
        console.error("Error starting shift:", err);
        res.status(500).json({ message: "Failed to start shift" });
    }
};
exports.startShift = startShift;
const endShift = async (req, res) => {
    const user = req.user;
    try {
        const timestamp = await getGermanTime();
        const records = loadAttendance();
        const lastIn = records
            .filter(r => r.user.id === user.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .find(r => r.type === "in");
        const lastOut = records
            .filter(r => r.user.id === user.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .find(r => r.type === "out");
        if (!lastIn || (lastOut && new Date(lastOut.timestamp) > new Date(lastIn.timestamp))) {
            return res.status(400).json({ message: "No open shift found to close." });
        }
        const newRecord = {
            id: (0, uuid_1.v4)(),
            user,
            type: "out",
            timestamp,
        };
        records.push(newRecord);
        saveAttendance(records);
        res.status(201).json({ message: "Shift ended", record: newRecord });
    }
    catch (err) {
        console.error("Error ending shift:", err);
        res.status(500).json({ message: "Failed to end shift" });
    }
};
exports.endShift = endShift;
const editRecord = (req, res) => {
    const recordId = req.params.id;
    const { type, timestamp } = req.body;
    if (!type || !timestamp) {
        return res.status(400).json({ message: "Missing fields: type and timestamp are required" });
    }
    const records = loadAttendance();
    const recordIndex = records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) {
        return res.status(404).json({ message: "Record not found" });
    }
    records[recordIndex].type = type;
    records[recordIndex].timestamp = timestamp;
    saveAttendance(records);
    res.status(200).json({
        message: "Record updated successfully",
        record: records[recordIndex],
    });
};
exports.editRecord = editRecord;
const getAttendanceSummary = (req, res) => {
    const { from, to, userId } = req.query;
    const isAdmin = req.user?.role === "admin";
    const currentUserId = req.user?.id;
    if (!from || !to) {
        return res.status(400).json({ message: "From and To dates are required." });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const targetUserId = isAdmin && userId ? userId : currentUserId;
    const records = loadAttendance().filter((record) => {
        return (record.user.id === targetUserId &&
            new Date(record.timestamp) >= fromDate &&
            new Date(record.timestamp) <= toDate);
    });
    let totalMilliseconds = 0;
    let inTime = null;
    for (const record of records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())) {
        const ts = new Date(record.timestamp);
        if (record.type === "in") {
            inTime = ts;
        }
        else if (record.type === "out" && inTime) {
            totalMilliseconds += ts.getTime() - inTime.getTime();
            inTime = null;
        }
    }
    const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    res.status(200).json({
        userId: targetUserId,
        from,
        to,
        totalHours,
        totalMinutes,
        records,
    });
};
exports.getAttendanceSummary = getAttendanceSummary;
const getAllAttendanceRecords = (req, res) => {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    try {
        const records = loadAttendance();
        res.status(200).json(records);
    }
    catch (err) {
        console.error("Error fetching attendance records:", err);
        res.status(500).json({ message: "Failed to fetch attendance records" });
    }
};
exports.getAllAttendanceRecords = getAllAttendanceRecords;
