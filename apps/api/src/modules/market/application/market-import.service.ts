import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { marketProductKey } from "../domain/market-product-key";
import { MarketRepository } from "../domain/market.repository";
import { extractAccessKey, parseNfcePage, ParsedNfceItem } from "../domain/nfce-parser";
import { SefazSpProvider } from "../infrastructure/providers/sefaz-sp.provider";
import { CommitNotaDto } from "./dto/market.dto";

export interface NotaPreview {
  accessKey: string;
  storeName: string | null;
  storeCnpj: string | null;
  purchaseDate: string | null;
  /** The portal's own "valor a pagar" when it exposed one. */
  totalAmount: number | null;
  /** Sum of the parsed lines — shown next to totalAmount so a partial parse is obvious. */
  itemsTotal: number;
  items: ParsedNfceItem[];
  /** True when the two totals disagree by more than a cent, i.e. some line failed to parse. */
  totalsMismatch: boolean;
}

/**
 * Scan → preview → commit, the same shape the B3 statement import already uses: nothing is
 * persisted from a scan alone. The preview is deliberately allowed to come back imperfect (missing
 * store name, a skipped line, mismatched totals) and say so, rather than being rejected wholesale —
 * the user is looking at the paper nota while confirming and can fix what the portal didn't give.
 */
@Injectable()
export class MarketImportService {
  private readonly logger = new Logger(MarketImportService.name);

  constructor(
    private readonly sefaz: SefazSpProvider,
    private readonly market: MarketRepository,
  ) {}

  async preview(userId: string, code: string): Promise<NotaPreview> {
    const accessKey = extractAccessKey(code);
    if (!accessKey) {
      throw new BadRequestException("Não reconheci uma nota fiscal nesse código. Escaneie o QR Code da nota ou digite a chave de 44 dígitos.");
    }

    const existing = await this.market.findPurchaseByAccessKey(userId, accessKey);
    if (existing) {
      throw new ConflictException(`Essa nota já foi importada em ${existing.purchaseDate.toISOString().slice(0, 10)}.`);
    }

    // The scanned payload is only useful to the portal when it's the full "p=" string; a typed key
    // has no signature fields to pass along.
    const qrPayload = code.includes("p=") ? decodeURIComponent(code.split("p=")[1].split("&")[0]) : undefined;

    let html: string;
    try {
      html = await this.sefaz.fetchNotaPage({ qrPayload, accessKey });
    } catch (err) {
      this.logger.warn(`Falha ao buscar nota ${accessKey} na SEFAZ-SP: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Não consegui falar com a SEFAZ-SP agora. Tente de novo em alguns minutos.");
    }

    const parsed = parseNfcePage(html);
    if (parsed.items.length === 0) {
      throw new BadRequestException(
        "A SEFAZ respondeu, mas não encontrei os itens nessa nota. Pode ser uma nota antiga, ou o portal pediu verificação — tente escanear o QR Code de novo.",
      );
    }

    const itemsTotal = round2(parsed.items.reduce((sum, item) => sum + item.totalPrice, 0));

    return {
      accessKey,
      storeName: parsed.storeName,
      storeCnpj: parsed.storeCnpj,
      purchaseDate: parsed.purchaseDate,
      totalAmount: parsed.totalAmount,
      itemsTotal,
      items: parsed.items,
      totalsMismatch: parsed.totalAmount !== null && Math.abs(parsed.totalAmount - itemsTotal) > 0.01,
    };
  }

  async commit(userId: string, dto: CommitNotaDto) {
    if (dto.accessKey) {
      const existing = await this.market.findPurchaseByAccessKey(userId, dto.accessKey);
      if (existing) throw new ConflictException("Essa nota já foi importada.");
    }

    return this.market.createPurchase({
      userId,
      storeName: dto.storeName,
      storeCnpj: dto.storeCnpj ?? null,
      accessKey: dto.accessKey ?? null,
      purchaseDate: new Date(`${dto.purchaseDate.slice(0, 10)}T12:00:00`),
      totalAmount: dto.totalAmount,
      notes: dto.notes,
      items: dto.items.map((item) => ({
        description: item.description,
        storeCode: item.storeCode ?? null,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        normalizedKey: marketProductKey(item.description),
      })),
    });
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
