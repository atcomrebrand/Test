import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { B3ImportService } from "../application/b3-import.service";
import { B3ImportCommitDto, B3ImportPreviewDto, CsvImportPreviewDto } from "../application/dto/b3-import.dto";

/** Import wizard for B3's "Negociação" (trade blotter) and "Movimentação" (extrato) exports —
 *  preview is read-only (classifies rows, dedupes against what's already on file, and suggests
 *  dividend backfill from BRAPI), commit is the explicit confirmed write. Nothing is persisted
 *  from preview alone. */
@UseGuards(JwtAuthGuard)
@Controller("investments/import/b3")
export class B3ImportController {
  constructor(private readonly importService: B3ImportService) {}

  @Post("preview")
  preview(@CurrentUser() user: AuthUser, @Body() dto: B3ImportPreviewDto) {
    return this.importService.preview(user.userId, dto.negociacao ?? [], dto.movimentacao ?? []);
  }

  @Post("commit")
  commit(@CurrentUser() user: AuthUser, @Body() dto: B3ImportCommitDto) {
    return this.importService.commit(user.userId, dto.transactions, dto.incomes);
  }

  /** Alternate, simpler import source: a single CSV with one row per transaction, no separate
   *  dividend/movimentação file — reuses the same commit endpoint above since its output is the
   *  same ImportedTransaction[] shape regardless of source. */
  @Post("csv/preview")
  previewCsv(@CurrentUser() user: AuthUser, @Body() dto: CsvImportPreviewDto) {
    return this.importService.previewCsv(user.userId, dto.rows);
  }
}
