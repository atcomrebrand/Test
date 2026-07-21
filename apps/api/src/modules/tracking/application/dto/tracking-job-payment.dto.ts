import { Type } from "class-transformer";
import { IsNumber, IsPositive } from "class-validator";

export class ConfirmTrackingJobPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;
}
