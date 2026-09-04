import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { NewsService } from "../application/news.service";

@UseGuards(JwtAuthGuard)
@Controller("investments/news")
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get("market")
  market() {
    return this.news.getMarketNews();
  }

  @Get("portfolio")
  portfolio(@CurrentUser() user: AuthUser) {
    return this.news.getPortfolioNews(user.userId);
  }

  @Get("preview")
  preview(@Query("link") link?: string) {
    if (!link) throw new BadRequestException("O parâmetro 'link' é obrigatório.");
    return this.news.getArticlePreview(link);
  }
}
