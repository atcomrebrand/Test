import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

const STATUSES = ["PENDING", "PAID", "LATE", "CANCELLED"] as const;

export class InstallmentQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() cardId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxAmount?: number;
}

export class UpdateInstallmentStatusDto {
  @IsIn(["CANCELLED"])
  status!: "CANCELLED";
}

export class PayInstallmentDto {
  @IsOptional() @IsNumber() amountPaid?: number;
  @IsOptional() @IsString() method?: string;
}
