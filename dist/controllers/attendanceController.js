"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.editShiftRecord = exports.deleteShiftRecord = exports.getCurrentShift = exports.endShift = exports.getAttendanceSummary = exports.startShift = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
const attendancePath = path_1.default.join(__dirname, "../data/attendance.json");
const pendingUserWrites = new Set();
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
    try {
        const response = await axios_1.default.get("https://timeapi.io/api/Time/current/zone?timeZone=Europe/Berlin");
        return response.data.dateTime;
    }
    catch (error) {
        console.warn("Failed to fetch Berlin time. Falling back to local server time.", error);
        return new Date().toISOString(); // fallback
    }
};
const startShift = async (req, res) => {
    const user = req.user;
    if (pendingUserWrites.has(user.id)) {
        return res.status(409).json({ message: "Shift action already in progress. Please wait..." });
    }
    pendingUserWrites.add(user.id);
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
        const fd = fs_1.default.openSync(attendancePath, 'r+');
        fs_1.default.fsyncSync(fd);
        fs_1.default.closeSync(fd);
        res.status(201).json({ message: "Shift started", record: newRecord });
    }
    catch (err) {
        console.error("Error starting shift:", err);
        res.status(500).json({ message: "Failed to start shift" });
    }
    finally {
        pendingUserWrites.delete(user.id);
    }
};
exports.startShift = startShift;
const getAttendanceSummary = (req, res) => {
    const { from, to, userId } = req.query;
    if (!from || !to) {
        return res.status(400).json({ message: "From and To dates are required." });
    }
    console.log(`userId from frontend: ${userId || 'ALL USERS'}`);
    console.log(`Date range received: from ${from} to ${to}`);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    console.log("fromDate:", fromDate);
    console.log("toDate:", toDate);
    const allRecords = loadAttendance().filter((record) => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= fromDate && recordDate <= toDate;
    });
    console.log("All records in the date range:", allRecords);
    const groupedByUser = {};
    allRecords.forEach((record) => {
        const uid = record.user.id;
        if (!groupedByUser[uid])
            groupedByUser[uid] = [];
        groupedByUser[uid].push(record);
    });
    console.log("👥 Grouped records by user. Total users:", Object.keys(groupedByUser).length);
    const usersToProcess = userId ? [userId] : Object.keys(groupedByUser);
    const allSummaries = usersToProcess.map((uid) => {
        const records = groupedByUser[uid] || [];
        records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        console.log(`📌 Calculating for user ID: ${uid}`);
        const inStack = [];
        let totalMilliseconds = 0;
        const updatedRecords = [];
        records.forEach((record) => {
            const ts = new Date(record.timestamp);
            if (record.type === "in") {
                inStack.push(record);
            }
            else if (record.type === "out" && inStack.length > 0) {
                const inRecord = inStack.shift();
                const inTime = new Date(inRecord.timestamp);
                const outTime = ts;
                const duration = outTime.getTime() - inTime.getTime();
                totalMilliseconds += duration;
                updatedRecords.push({
                    id: inRecord.id,
                    user: inRecord.user,
                    timestamp: inRecord.timestamp,
                    type: inRecord.type,
                    endTime: outTime.toISOString(),
                    hours: duration / (1000 * 60 * 60),
                    date: new Date(inTime).toLocaleDateString(),
                    outId: record.id,
                });
            }
        });
        if (inStack.length > 0) {
            console.warn(`Found ${inStack.length} unmatched IN records (without OUT) for user ${uid}`);
        }
        const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
        const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`Total shifts sent for ${uid}: ${updatedRecords.length}\n`);
        return {
            userId: uid,
            from,
            to,
            totalHours,
            totalMinutes,
            records: updatedRecords,
        };
    });
    const result = userId
        ? allSummaries.find((summary) => summary.userId === userId)
        : allSummaries;
    console.log("Summary sent to frontend:");
    console.log(JSON.stringify(result, null, 2));
    res.status(200).json(result);
};
exports.getAttendanceSummary = getAttendanceSummary;
const endShift = async (req, res) => {
    const user = req.user;
    if (pendingUserWrites.has(user.id)) {
        return res.status(409).json({ message: "Shift action already in progress. Please wait..." });
    }
    pendingUserWrites.add(user.id);
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
    finally {
        pendingUserWrites.delete(user.id);
    }
};
exports.endShift = endShift;
const getCurrentShift = (req, res) => {
    const user = req.user;
    if (!user) {
        return res.status(400).json({ message: "User not authenticated" });
    }
    try {
        console.log(`Fetching current shift for user: ${user.username}`);
        const records = loadAttendance();
        console.log("Loaded attendance records:", records);
        if (records.length === 0) {
            console.log("No attendance records found.");
            return res.status(200).json({ message: "No attendance records found, please start your shift." });
        }
        const userShifts = records.filter((r) => r.user.id === user.id);
        console.log(`User's shifts: ${JSON.stringify(userShifts)}`);
        const currentShift = userShifts
            .filter((r) => r.type === "in")
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        console.log("Current shift found:", currentShift);
        if (currentShift) {
            const hasOutShift = userShifts
                .filter((r) => r.type === "out")
                .some((r) => new Date(r.timestamp) > new Date(currentShift.timestamp));
            console.log("Has out shift after current 'in' shift:", hasOutShift);
            if (currentShift && !hasOutShift) {
                return res.status(200).json({
                    message: "Active shift found",
                    shift: currentShift,
                });
            }
            return res.status(200).json({
                message: "No active shift found.",
                lastShift: currentShift || null,
            });
        }
    }
    catch (err) {
        console.error("Error fetching current shift:", err);
        return res.status(500).json({ message: "Failed to fetch current shift" });
    }
};
exports.getCurrentShift = getCurrentShift;
const deleteShiftRecord = (req, res) => {
    const recordId = req.params.id;
    const records = loadAttendance();
    const recordIndex = records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) {
        return res.status(404).json({ message: "Record not found" });
    }
    const recordToDelete = records[recordIndex];
    const remainingRecords = records.filter(r => r.id !== recordToDelete.id); // ← שינוי פה בלבד!
    saveAttendance(remainingRecords);
    return res.status(200).json({
        message: "Shift deleted successfully",
        record: recordToDelete,
    });
};
exports.deleteShiftRecord = deleteShiftRecord;
const editShiftRecord = (req, res) => {
    const recordId = req.params.id;
    const { timestamp, type } = req.body;
    if (!timestamp || !type) {
        return res.status(400).json({ message: "Missing fields: type and timestamp are required" });
    }
    const records = loadAttendance();
    const recordIndex = records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) {
        return res.status(404).json({ message: "Record not found" });
    }
    records[recordIndex].timestamp = timestamp;
    records[recordIndex].type = type;
    saveAttendance(records);
    return res.status(200).json({
        message: "Record updated successfully",
        record: records[recordIndex],
    });
};
exports.editShiftRecord = editShiftRecord;
