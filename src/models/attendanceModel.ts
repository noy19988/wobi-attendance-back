import { User } from "./userModel";

export interface AttendanceRecord {
  id: string;
  user: User;
  type: "in" | "out";
  timestamp: string;
}
