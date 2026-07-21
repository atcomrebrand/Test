import { TrackingProject } from "@prisma/client";

export interface CreateTrackingProjectData {
  userId: string;
  name: string;
  client?: string;
  amountReceived: number;
  date: Date;
  hoursSpent: number;
  status?: string;
  notes?: string;
}

export abstract class TrackingProjectRepository {
  abstract findAllByUser(userId: string): Promise<TrackingProject[]>;
  abstract findById(id: string): Promise<TrackingProject | null>;
  abstract create(data: CreateTrackingProjectData): Promise<TrackingProject>;
  abstract update(id: string, data: Record<string, unknown>): Promise<TrackingProject>;
  abstract softDelete(id: string): Promise<void>;
}
