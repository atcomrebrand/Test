import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min, MinLength } from "class-validator";

export class CreateTrackingJobDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  company!: string;

  @IsOptional()
  @IsString()
  client?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monthlyValue!: number;

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
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) company?: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() monthlyValue?: number;
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
