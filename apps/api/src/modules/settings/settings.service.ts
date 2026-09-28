import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateSettingsDto } from "./dto/settings.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.prisma.setting.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.setting.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }
}
