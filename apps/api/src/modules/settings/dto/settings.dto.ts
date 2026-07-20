import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional() @IsIn(["LIGHT", "DARK", "SYSTEM"]) theme?: "LIGHT" | "DARK" | "SYSTEM";
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() alertUpcomingDue?: boolean;
  @IsOptional() @IsBoolean() alertLimitWarning?: boolean;
  @IsOptional() @IsBoolean() alertLateInstall?: boolean;
  @IsOptional() @IsBoolean() alertSpendingJump?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(100) limitWarningPct?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) dashboardWidgets?: string[];
  @IsOptional() @IsBoolean() includeFinancingInTotals?: boolean;
}
