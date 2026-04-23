export interface Player {
  id: string;
  name: string;
  buy_in: number;
  chips: number; // Final chip count at the end of the night
  result?: number;
}

export interface PokerSession {
  id: string;
  date: string;
  players: Player[];
}