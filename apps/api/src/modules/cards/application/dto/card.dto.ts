import { IsBoolean, IsHexColor, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Length, Max, Min, MinLength } from "class-validator";

const BRANDS = ["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OTHER"] as const;

export class CreateCardDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  bank!: string;

  @IsIn(BRANDS)
  brand!: (typeof BRANDS)[number];

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsNumber()
  @IsPositive()
  limitAmount!: number;

  @IsString()
  @Length(4, 4)
  lastDigits!: string;

  @IsInt()
  @Min(1)
  @Max(31)
  closingDay!: number;

  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;
}

export class UpdateCardDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) bank?: string;
  @IsOptional() @IsIn(BRANDS) brand?: (typeof BRANDS)[number];
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsNumber() @IsPositive() limitAmount?: number;
  @IsOptional() @IsString() @Length(4, 4) lastDigits?: string;
  @IsOptional() @IsInt() @Min(1) @Max(31) closingDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) dueDay?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
