
export interface Game {
  id: string;
  prompt: string;
  created_at: string;
}

export const gameTypes = [
  { id: 'puzzle', label: 'Puzzle Games (like Candy Crush)', example: 'matching puzzles, sliding puzzles, or block-clearing mechanics' },
  { id: 'word', label: 'Word Games (like Wordle)', example: 'word guessing, crosswords, or letter arrangements' },
  { id: 'arcade', label: 'Arcade Games (like Space Invaders)', example: 'fast-paced action, shooting, or obstacle avoidance' },
  { id: 'card', label: 'Card Games (like Solitaire)', example: 'card matching, deck building, or traditional card games' },
  { id: 'strategy', label: 'Strategy Games (like Tower Defense)', example: 'resource management, tower placement, or tactical decisions' },
  { id: 'action', label: 'Action Games (like Super Mario)', example: 'platforming, running, jumping, or collecting items' }
] as const;
