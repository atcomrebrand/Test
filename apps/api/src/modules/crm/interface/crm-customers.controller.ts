import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CrmCustomersService } from "../application/crm-customers.service";
import {
  CancelCustomerDto,
  CreateCrmCustomerDto,
  CreateCrmPaymentDto,
  CreateCrmSubscriptionDto,
  RenewSubscriptionDto,
  UpdateCrmCustomerDto,
  UpdateCrmSubscriptionDto,
} from "../application/dto/crm-customer.dto";

@UseGuards(JwtAuthGuard)
@Controller("crm")
export class CrmCustomersController {
  constructor(private readonly service: CrmCustomersService) {}

  @Get("customers")
  list(
    @CurrentUser() user: AuthUser,
    @Query("portfolioId") portfolioId?: string,
    @Query("dueWithinDays") dueWithinDays?: string,
    @Query("onlyLate") onlyLate?: string,
    @Query("originId") originId?: string,
    @Query("tagIds") tagIds?: string,
    @Query("search") search?: string,
  ) {
    return this.service.list(user.userId, {
      portfolioId,
      dueWithinDays: dueWithinDays !== undefined ? Number(dueWithinDays) : undefined,
      onlyLate: onlyLate === "true",
      originId,
      tagIds: tagIds ? tagIds.split(",").filter(Boolean) : undefined,
      search,
    });
  }

  @Post("customers")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmCustomerDto) {
    return this.service.create(user.userId, dto);
  }

  @Get("customers/:id")
  detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.detail(user.userId, id);
  }

  @Patch("customers/:id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmCustomerDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete("customers/:id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }

  @Post("customers/:id/cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CancelCustomerDto) {
    return this.service.cancel(user.userId, id, dto);
  }

  @Post("customers/:id/reactivate")
  reactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.reactivate(user.userId, id);
  }

  @Get("customers/:id/events")
  events(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.listEvents(user.userId, id);
  }

  @Post("subscriptions")
  createSubscription(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmSubscriptionDto) {
    return this.service.createSubscription(user.userId, dto);
  }

  @Patch("subscriptions/:id")
  updateSubscription(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmSubscriptionDto) {
    return this.service.updateSubscription(user.userId, id, dto);
  }

  /** A operação de um clique: sem corpo, herda tudo da assinatura. */
  @Post("subscriptions/:id/renew")
  renew(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: RenewSubscriptionDto) {
    return this.service.renew(user.userId, id, dto);
  }

  @Post("payments")
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmPaymentDto) {
    return this.service.createPayment(user.userId, dto);
  }

  @Post("payments/:id/reverse")
  reversePayment(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.reversePayment(user.userId, id);
  }
}
