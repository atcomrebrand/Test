import { IsDateString, IsOptional, IsString } from "class-validator";

export class StartSessionDto {
  @IsString()
  jobId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class FinishSessionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ManualEditSessionDto {
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsString() notes?: string;
}
