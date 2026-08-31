import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingSessionsService } from "../application/tracking-sessions.service";
import { CreateManualSessionDto, FinishSessionDto, ManualEditSessionDto, StartSessionDto } from "../application/dto/tracking-session.dto";

@UseGuards(JwtAuthGuard)
@Controller("tracking/sessions")
export class TrackingSessionsController {
  constructor(private readonly service: TrackingSessionsService) {}

  @Get("active")
  getActive(@CurrentUser() user: AuthUser) {
    return this.service.getActive(user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.service.findAll(user.userId, from, to);
  }

  @Post("start")
  start(@CurrentUser() user: AuthUser, @Body() dto: StartSessionDto) {
    return this.service.start(user.userId, dto);
  }

  @Post("manual")
  createManual(@CurrentUser() user: AuthUser, @Body() dto: CreateManualSessionDto) {
    return this.service.createManual(user.userId, dto);
  }

  @Post(":id/pause")
  pause(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.pause(user.userId, id);
  }

  @Post(":id/resume")
  resume(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.resume(user.userId, id);
  }

  @Post(":id/finish")
  finish(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: FinishSessionDto) {
    return this.service.finish(user.userId, id, dto);
  }

  @Patch(":id")
  updateManual(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ManualEditSessionDto) {
    return this.service.updateManual(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }
}
