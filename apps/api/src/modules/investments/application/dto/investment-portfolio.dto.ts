import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateInvestmentPortfolioDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateInvestmentPortfolioDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
