import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingPlacementService } from "../application/tracking-placement.service";

@UseGuards(JwtAuthGuard)
@Controller("tracking/placement")
export class TrackingPlacementController {
  constructor(private readonly service: TrackingPlacementService) {}

  @Get("evolution")
  evolution(@CurrentUser() user: AuthUser) {
    return this.service.evolution(user.userId);
  }
}
