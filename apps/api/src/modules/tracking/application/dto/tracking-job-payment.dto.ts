import { Type } from "class-transformer";
import { IsNumber, IsPositive } from "class-validator";

export class ConfirmTrackingJobPaymentDto {
  /** Sempre em reais — o valor que efetivamente caiu na conta, independente da moeda do trabalho. */
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;
}
