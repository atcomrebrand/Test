import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingJobPaymentsService } from "../application/tracking-job-payments.service";
import { ConfirmTrackingJobPaymentDto } from "../application/dto/tracking-job-payment.dto";

@UseGuards(JwtAuthGuard)
@Controller("tracking/job-payments")
export class TrackingJobPaymentsController {
  constructor(private readonly service: TrackingJobPaymentsService) {}

  @Get("pending")
  pending(@CurrentUser() user: AuthUser) {
    return this.service.pending(user.userId);
  }

  @Get(":jobId/history")
  history(@CurrentUser() user: AuthUser, @Param("jobId") jobId: string) {
    return this.service.history(user.userId, jobId);
  }

  @Post(":jobId/confirm")
  confirm(@CurrentUser() user: AuthUser, @Param("jobId") jobId: string, @Body() dto: ConfirmTrackingJobPaymentDto) {
    return this.service.confirm(user.userId, jobId, dto);
  }
}
