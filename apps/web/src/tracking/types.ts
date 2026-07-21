export type TrackingSessionStatus = "RUNNING" | "PAUSED" | "COMPLETED";

export interface TrackingJob {
  id: string;
  name: string;
  company: string;
  client: string | null;
  monthlyValue: string;
  expectedHoursPerDay: number;
  startDate: string;
  endDate: string | null;
  paymentMethod: string | null;
  color: string;
  weekdays: number[];
  notes: string | null;
  active: boolean;
  estimatedHourlyRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingSessionPause {
  id: string;
  sessionId: string;
  pausedAt: string;
  resumedAt: string | null;
}

export interface TrackingSession {
  id: string;
  userId: string;
  jobId: string;
  checkIn: string;
  checkOut: string | null;
  status: TrackingSessionStatus;
  notes: string | null;
  pauses: TrackingSessionPause[];
  job: TrackingJob;
  grossSeconds: number;
  pauseSeconds: number;
  netSeconds: number;
  hourlyRate: number;
  equivalentValue: number;
  isLongRunning: boolean;
  createdAt: string;
  updatedAt: string;
}
