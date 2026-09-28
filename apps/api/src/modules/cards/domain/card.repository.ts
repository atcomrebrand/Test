import { Card, CardBrand } from "@prisma/client";

export interface CreateCardData {
  userId: string;
  name: string;
  bank: string;
  brand: CardBrand;
  color: string;
  limitAmount: number;
  lastDigits: string;
  closingDay: number;
  dueDay: number;
}

export interface UpdateCardData extends Partial<Omit<CreateCardData, "userId">> {
  active?: boolean;
}

/** Port: application layer depends on this abstraction, not on Prisma directly. */
export abstract class CardRepository {
  abstract findAllByUser(userId: string): Promise<Card[]>;
  abstract findById(id: string): Promise<Card | null>;
  abstract create(data: CreateCardData): Promise<Card>;
  abstract update(id: string, data: UpdateCardData): Promise<Card>;
  abstract delete(id: string): Promise<void>;
  /** Compras deste cartão, **incluindo as que estão na lixeira** — é o que a chave estrangeira do
   *  banco enxerga, e a guarda de exclusão precisa enxergar o mesmo pra não virar erro 500. */
  abstract countPurchases(id: string): Promise<number>;
  abstract sumSpentByCard(id: string): Promise<number>;
}
