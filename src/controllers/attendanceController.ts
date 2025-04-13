import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { AttendanceRecord } from "../models/attendanceModel";
import { User } from "../models/userModel";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

interface TimeApiResponse {
  dateTime: string;
}

const attendancePath = path.join(__dirname, "../data/attendance.json");

const loadAttendance = (): AttendanceRecord[] => {
  if (!fs.existsSync(attendancePath)) return [];
  const data = fs.readFileSync(attendancePath, "utf-8");
  return data.trim() ? JSON.parse(data) : [];
};

const saveAttendance = (records: AttendanceRecord[]) => {
  fs.writeFileSync(attendancePath, JSON.stringify(records, null, 2));
};

const getGermanTime = async (): Promise<string> => {
  const response = await axios.get<TimeApiResponse>(
    "https://timeapi.io/api/Time/current/zone?timeZone=Europe/Berlin"
  );
  return response.data.dateTime;
};









export const startShift = async (req: Request, res: Response) => {
  const user = (req as any).user as User;

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

    const newRecord: AttendanceRecord = {
      id: uuidv4(),
      user,
      type: "in",
      timestamp,
    };

    records.push(newRecord);
    saveAttendance(records);

    res.status(201).json({ message: "Shift started", record: newRecord });
  } catch (err) {
    console.error("Error starting shift:", err);
    res.status(500).json({ message: "Failed to start shift" });
  }
};












export const endShift = async (req: Request, res: Response) => {
  const user = (req as any).user as User;

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

    const newRecord: AttendanceRecord = {
      id: uuidv4(),
      user,
      type: "out",
      timestamp,
    };

    records.push(newRecord);
    saveAttendance(records);

    res.status(201).json({ message: "Shift ended", record: newRecord });
  } catch (err) {
    console.error("Error ending shift:", err);
    res.status(500).json({ message: "Failed to end shift" });
  }
};









export const editRecord = (req: Request, res: Response) => {
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












export const getAttendanceSummary = (req: AuthenticatedRequest, res: Response) => {
  const { from, to, userId } = req.query as {
    from?: string;
    to?: string;
    userId?: string;
  };

  const isAdmin = req.user?.role === "admin";
  const currentUserId = req.user?.id;

  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required." });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const targetUserId = isAdmin && userId ? userId : currentUserId;

  const records = loadAttendance().filter((record) => {
    return (
      record.user.id === targetUserId &&
      new Date(record.timestamp) >= fromDate &&
      new Date(record.timestamp) <= toDate
    );
  });


  let totalMilliseconds = 0;
  let inTime: Date | null = null;

  for (const record of records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())) {
    const ts = new Date(record.timestamp);
    if (record.type === "in") {
      inTime = ts;
    } else if (record.type === "out" && inTime) {
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




export const getAllAttendanceRecords = (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  try {
    const records = loadAttendance();
    res.status(200).json(records);
  } catch (err) {
    console.error("Error fetching attendance records:", err);
    res.status(500).json({ message: "Failed to fetch attendance records" });
  }
};