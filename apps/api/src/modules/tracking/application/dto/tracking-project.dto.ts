import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

const STATUSES = ["EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"] as const;

export class CreateTrackingProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  client?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amountReceived!: number;

  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  hoursSpent!: number;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTrackingProjectDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() amountReceived?: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() hoursSpent?: number;
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsString() notes?: string;
}
