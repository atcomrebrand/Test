import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TrackingProjectRepository } from "../domain/tracking-project.repository";
import { TrackingAuditService } from "./tracking-audit.service";
import { CreateTrackingProjectDto, UpdateTrackingProjectDto } from "./dto/tracking-project.dto";

@Injectable()
export class TrackingProjectsService {
  constructor(
    private readonly projects: TrackingProjectRepository,
    private readonly audit: TrackingAuditService,
  ) {}

  findAll(userId: string) {
    return this.projects.findAllByUser(userId);
  }

  async findOne(userId: string, id: string) {
    return this.getOwned(userId, id);
  }

  async create(userId: string, dto: CreateTrackingProjectDto) {
    const project = await this.projects.create({
      userId,
      name: dto.name,
      client: dto.client,
      amountReceived: dto.amountReceived,
      date: new Date(dto.date),
      hoursSpent: dto.hoursSpent,
      status: dto.status,
      notes: dto.notes,
    });
    await this.audit.log(userId, "TrackingProject", project.id, "CREATE", null, project);
    return project;
  }

  async update(userId: string, id: string, dto: UpdateTrackingProjectDto) {
    const before = await this.getOwned(userId, id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    const after = await this.projects.update(id, data);
    await this.audit.log(userId, "TrackingProject", id, "UPDATE", before, after);
    return after;
  }

  async remove(userId: string, id: string) {
    const before = await this.getOwned(userId, id);
    await this.projects.softDelete(id);
    await this.audit.log(userId, "TrackingProject", id, "DELETE", before, null);
    return { id };
  }

  private async getOwned(userId: string, id: string) {
    const project = await this.projects.findById(id);
    if (!project) throw new NotFoundException("Projeto não encontrado.");
    if (project.userId !== userId) throw new ForbiddenException();
    return project;
  }
}
