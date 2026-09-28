import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingSearchService } from "../application/tracking-search.service";

@UseGuards(JwtAuthGuard)
@Controller("tracking/search")
export class TrackingSearchController {
  constructor(private readonly service: TrackingSearchService) {}

  @Get()
  search(@CurrentUser() user: AuthUser, @Query("q") q: string = "") {
    return this.service.search(user.userId, q);
  }
}
