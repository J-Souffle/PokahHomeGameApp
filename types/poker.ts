export interface Player {
  id: string;
  name: string;
  buyIn: number;
  chips: number; // Final chip count at the end of the night
}

export interface PokerSession {
  id: string;
  date: string;
  players: Player[];
}