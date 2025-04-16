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


interface CombinedShift extends AttendanceRecord {
  endTime?: string;
  hours?: number;
  date?: string;
  outId?: string; 
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
    console.log("Timestamp for the shift:", timestamp);  

    const records = loadAttendance();
    console.log("Loaded attendance records:", records); 

    const lastIn = records
      .filter(r => r.user.id === user.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .find(r => r.type === "in");
    console.log("Last 'in' shift:", lastIn); 

    const lastOut = records
      .filter(r => r.user.id === user.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .find(r => r.type === "out");
    console.log("Last 'out' shift:", lastOut);  

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


    const fd = fs.openSync(attendancePath, 'r+');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    
    console.log("Shift started successfully:", newRecord);  

    res.status(201).json({ message: "Shift started", record: newRecord });
  } catch (err) {
    console.error("Error starting shift:", err);
    res.status(500).json({ message: "Failed to start shift" });
  }
};







export const getAttendanceSummary = (req: AuthenticatedRequest, res: Response) => {
  const { from, to, userId } = req.query as {
    from?: string;
    to?: string;
    userId?: string;
  };

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

  const groupedByUser: Record<string, AttendanceRecord[]> = {};
  allRecords.forEach((record) => {
    const uid = record.user.id;
    if (!groupedByUser[uid]) groupedByUser[uid] = [];
    groupedByUser[uid].push(record);
  });

  console.log("👥 Grouped records by user. Total users:", Object.keys(groupedByUser).length);

  const usersToProcess = userId ? [userId] : Object.keys(groupedByUser);

  const allSummaries = usersToProcess.map((uid) => {
    const records = groupedByUser[uid] || [];
    records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`📌 Calculating for user ID: ${uid}`);
    const inStack: AttendanceRecord[] = [];
    let totalMilliseconds = 0;
    const updatedRecords: CombinedShift[] = [];

    records.forEach((record) => {
      const ts = new Date(record.timestamp);

      if (record.type === "in") {
        inStack.push(record);
      } else if (record.type === "out" && inStack.length > 0) {
        const inRecord = inStack.shift()!;
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










export const endShift = async (req: Request, res: Response) => {
  const user = (req as any).user as User;

  try {
    const timestamp = await getGermanTime();
    console.log("Timestamp for ending the shift:", timestamp); 

    const records = loadAttendance();
    console.log("Loaded attendance records:", records);  

    const lastIn = records
      .filter(r => r.user.id === user.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .find(r => r.type === "in");
    console.log("Last 'in' shift:", lastIn);  

    const lastOut = records
      .filter(r => r.user.id === user.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .find(r => r.type === "out");
    console.log("Last 'out' shift:", lastOut);  

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
    console.log("Shift ended successfully:", newRecord);  

    res.status(201).json({ message: "Shift ended", record: newRecord });
  } catch (err) {
    console.error("Error ending shift:", err);
    res.status(500).json({ message: "Failed to end shift" });
  }
};








export const getCurrentShift = (req: AuthenticatedRequest, res: Response) => {
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

  } catch (err) {
    console.error("Error fetching current shift:", err);
    return res.status(500).json({ message: "Failed to fetch current shift" });
  }
};




export const deleteShiftRecord = (req: Request, res: Response) => {
  const recordId = req.params.id; 

  const records = loadAttendance();  
  const recordIndex = records.findIndex((r) => r.id === recordId); 

  if (recordIndex === -1) {
    return res.status(404).json({ message: "Record not found" });
  }

  const recordToDelete = records[recordIndex];

  const remainingRecords = records.filter(r => {

    return r.user.id !== recordToDelete.user.id || (r.type !== recordToDelete.type);
  });

  saveAttendance(remainingRecords);  

  return res.status(200).json({
    message: "Shift deleted successfully",
    record: recordToDelete,
  });
};






export const editShiftRecord = (req: Request, res: Response) => {
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
