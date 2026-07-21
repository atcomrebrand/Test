import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min, MinLength, ValidateIf } from "class-validator";

export class CreateTrackingJobDto {
  @IsOptional()
  @IsIn(["FIXO", "FREELANCE"])
  type?: "FIXO" | "FREELANCE";

  @IsString()
  @MinLength(1)
  name!: string;

  /** Opcional pra FREELANCE — o service preenche com o cliente (ou "Freelance") quando ausente. */
  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  client?: string;

  /** Obrigatório só quando type = FIXO (o default). */
  @ValidateIf((o) => (o.type ?? "FIXO") === "FIXO")
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monthlyValue?: number;

  /** Obrigatório só quando type = FREELANCE. */
  @ValidateIf((o) => o.type === "FREELANCE")
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  totalAgreedValue?: number;

  @IsOptional()
  @IsIn(["BRL", "USD"])
  currency?: "BRL" | "USD";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  expectedHoursPerDay?: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTrackingJobDto {
  @IsOptional() @IsIn(["FIXO", "FREELANCE"]) type?: "FIXO" | "FREELANCE";
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() monthlyValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() totalAgreedValue?: number;
  @IsOptional() @IsIn(["BRL", "USD"]) currency?: "BRL" | "USD";
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() expectedHoursPerDay?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) paymentDay?: number;
  @IsOptional() @IsString() color?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
