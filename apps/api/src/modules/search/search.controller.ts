import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { SearchService } from "./search.service";

@UseGuards(JwtAuthGuard)
@Controller("search")
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  search(@CurrentUser() user: AuthUser, @Query("q") q: string) {
    return this.service.search(user.userId, q);
  }
}
