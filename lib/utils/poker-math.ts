export interface Transaction {
  from: string;
  to: string;
  amount: number;
}

export function calculateDebts(players: { name: string; net: number }[]): Transaction[] {
  const winners = players.filter((p) => p.net > 0).sort((a, b) => b.net - a.net);
  const losers = players.filter((p) => p.net < 0).sort((a, b) => a.net - b.net);

  const transactions: Transaction[] = [];
  let i = 0, j = 0;

  while (i < winners.length && j < losers.length) {
    const amount = Math.min(winners[i].net, Math.abs(losers[j].net));
    if (amount > 0) {
      transactions.push({
        from: losers[j].name,
        to: winners[i].name,
        amount: Number(amount.toFixed(2)),
      });
    }

    winners[i].net -= amount;
    losers[j].net += amount;

    if (winners[i].net <= 0) i++;
    if (losers[j].net >= 0) j++;
  }

  return transactions;
}