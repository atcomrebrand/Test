import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, MinLength, ValidateNested } from "class-validator";

/** Whatever the QR scan produced — the full NFC-e URL, or the 44-digit key typed by hand. Both are
 *  reduced to an access key server-side, so the client doesn't have to know the difference. */
export class ScanNotaDto {
  @IsString()
  @MinLength(10)
  code!: string;
}

export class ImportItemDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  storeCode?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsString()
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  unitPrice!: number;

  @Type(() => Number)
  @IsNumber()
  totalPrice!: number;
}

/** The confirmed contents of the preview screen — the user may have edited or removed lines, so
 *  the commit takes the reviewed list rather than re-fetching and trusting the portal again. */
export class CommitNotaDto {
  @IsString()
  @MinLength(1)
  storeName!: string;

  @IsOptional()
  @IsString()
  storeCnpj?: string;

  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsDateString()
  purchaseDate!: string;

  @Type(() => Number)
  @IsNumber()
  totalAmount!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportItemDto)
  items!: ImportItemDto[];
}

export class ListPurchasesQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
