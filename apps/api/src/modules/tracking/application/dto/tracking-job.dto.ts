import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, Min, MinLength, ValidateIf } from "class-validator";

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

  /** Datas específicas de folga ("YYYY-MM-DD"), além do padrão semanal em weekdays. */
  @IsOptional()
  @IsArray()
  @Matches(DATE_REGEX, { each: true, message: "daysOff deve conter datas no formato YYYY-MM-DD." })
  daysOff?: string[];

  /** Serviço com sistema de colocação: ao encerrar a sessão, o app pergunta posição, satisfação e
   *  tempo de resposta do dia. */
  @IsOptional()
  @IsBoolean()
  tracksPlacement?: boolean;

  /** "HH:mm" — dispara o lembrete "hora de iniciar" nesse horário, nos weekdays configurados. */
  @IsOptional()
  @Matches(HHMM_REGEX, { message: "expectedStartTime deve estar no formato HH:mm." })
  expectedStartTime?: string;

  /** "HH:mm" — dispara o lembrete "hora de encerrar" nesse horário exato pra sessão em andamento;
   *  quando ausente, o lembrete usa expectedHoursPerDay em vez de um horário fixo. */
  @IsOptional()
  @Matches(HHMM_REGEX, { message: "expectedEndTime deve estar no formato HH:mm." })
  expectedEndTime?: string;

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

  @IsOptional()
  @IsArray()
  @Matches(DATE_REGEX, { each: true, message: "daysOff deve conter datas no formato YYYY-MM-DD." })
  daysOff?: string[];

  @IsOptional() @IsBoolean() tracksPlacement?: boolean;

  @IsOptional() @Matches(HHMM_REGEX, { message: "expectedStartTime deve estar no formato HH:mm." }) expectedStartTime?: string;
  @IsOptional() @Matches(HHMM_REGEX, { message: "expectedEndTime deve estar no formato HH:mm." }) expectedEndTime?: string;

  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
