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


const cleanUserForStorage = (user: any): Partial<User> => {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
};


const attendancePath = path.join(__dirname, "../data/attendance.json");
const pendingUserWrites = new Set<string>();

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

  if (pendingUserWrites.has(user.id)) {
    return res.status(409).json({ message: "Shift action already in progress. Please wait..." });
  }

  pendingUserWrites.add(user.id);
  try {
    const timestamp = await getGermanTime();
    const records = loadAttendance();

    const userRecords = records
      .filter(r => r.user.id === user.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let openShiftExists = false;
    let lastIn: AttendanceRecord | undefined;

    for (const record of userRecords) {
      if (record.type === "in") {
        lastIn = record;
        openShiftExists = true;
      } else if (record.type === "out" && lastIn && new Date(record.timestamp) > new Date(lastIn.timestamp)) {
        openShiftExists = false;
        lastIn = undefined;
      }
    }

    if (openShiftExists) {
      return res.status(400).json({ message: "You already have an open shift." });
    }

    const cleanedUser = cleanUserForStorage(user);

    const newRecord: AttendanceRecord = {
      id: uuidv4(),
      user: cleanedUser as User,
      type: "in",
      timestamp,
    };

    records.push(newRecord);
    saveAttendance(records);

    res.status(201).json({ message: "Shift started", record: newRecord });
  } catch (err) {
    console.error("Error starting shift:", err);
    res.status(500).json({ message: "Failed to start shift" });
  } finally {
    pendingUserWrites.delete(user.id);
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


  const fromDate = new Date(from);
  const toDate = new Date(to);

  toDate.setHours(23, 59, 59, 999); 

  console.log("fromDate:", fromDate);
  console.log("toDate:", toDate);

  const allRecords = loadAttendance().filter((record) => {
    const recordDate = new Date(record.timestamp);
    return recordDate >= fromDate && recordDate <= toDate;
  });


  const groupedByUser: Record<string, AttendanceRecord[]> = {};
  allRecords.forEach((record) => {
    const uid = record.user.id;
    if (!groupedByUser[uid]) groupedByUser[uid] = [];
    groupedByUser[uid].push(record);
  });

  console.log("Grouped records by user. Total users:", Object.keys(groupedByUser).length);

  const usersToProcess = userId ? [userId] : Object.keys(groupedByUser);

  const allSummaries = usersToProcess.map((uid) => {
    const records = groupedByUser[uid] || [];
    records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const inStack: AttendanceRecord[] = [];
    let totalTime = 0;
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
        totalTime += duration;

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

    const totalHours = Math.floor(totalTime / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60));

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

    const cleanedUser = cleanUserForStorage(user);


    const newRecord: AttendanceRecord = {
      id: uuidv4(),
      user: cleanedUser as User,
      type: "out",
      timestamp,
    };

    records.push(newRecord);
    saveAttendance(records);
    
    res.status(201).json({ message: "Shift ended", record: newRecord });
  } catch (err) {
    console.error("Error ending shift:", err);
    res.status(500).json({ message: "Failed to end shift" });
  } finally {
    pendingUserWrites.delete(user.id);
  }
};







export const getCurrentShift = (req: AuthenticatedRequest, res: Response) => {
  const user = req.user; 
  
  if (!user) {
    return res.status(400).json({ message: "User not authenticated" });
  }

  try {

    const records = loadAttendance(); 

    if (records.length === 0) {
      return res.status(200).json({ message: "No attendance records found, please start your shift." });
    }

    const userShifts = records.filter((r) => r.user.id === user.id);


    const currentShift = userShifts
      .filter((r) => r.type === "in")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    

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

  const remainingRecords = records.filter(r => r.id !== recordToDelete.id);

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
