export interface PositionTransaction {
  type: "BUY" | "SELL";
  quantity: number;
  unitPrice: number;
  fees: number;
  transactionDate: Date;
}

export interface PositionResult {
  quantity: number;
  averagePrice: number;
  investedAmount: number;
  realizedProfit: number;
}

/**
 * Weighted average cost method ("preço médio"), the standard used by Brazilian individual
 * investors for IR purposes. A BUY blends into the average price; a SELL realizes profit against
 * the average price at that moment but never changes it. When the position is fully closed the
 * average price resets, so the next BUY starts a fresh lot.
 */
export function calculatePosition(transactions: PositionTransaction[]): PositionResult {
  const sorted = [...transactions].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());

  let quantity = 0;
  let averagePrice = 0;
  let realizedProfit = 0;

  for (const tx of sorted) {
    if (tx.type === "BUY") {
      const totalCost = quantity * averagePrice + tx.quantity * tx.unitPrice + tx.fees;
      quantity += tx.quantity;
      averagePrice = quantity > 0 ? totalCost / quantity : 0;
    } else {
      const sellQuantity = Math.min(tx.quantity, quantity);
      realizedProfit += (tx.unitPrice - averagePrice) * sellQuantity - tx.fees;
      quantity = Math.max(0, quantity - tx.quantity);
      if (quantity === 0) averagePrice = 0;
    }
  }

  return {
    quantity,
    averagePrice,
    investedAmount: quantity * averagePrice,
    realizedProfit,
  };
}
