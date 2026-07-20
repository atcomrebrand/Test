import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateCashAccountDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  balance!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCashAccountDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) balance?: number;
  @IsOptional() @IsString() notes?: string;
}
