export interface Team {
  name: string;
  short: string;
}

export interface Player {
  identity: string;
  name?: string;
  first?: string;
  last?: string;
  pos?: string;
  position?: string;
  offense?: string;
  defense?: string;
  special?: string;
  age?: number;
  salary?: string | number;
  team?: string;
  group?: string;
  core?: {
    first?: string;
    last?: string;
    age?: number;
    team?: string;
    pos?: {
      off?: string;
      def?: string;
      spec?: string;
    };
  };
  contract?: {
    salary?: string | number;
  };
  ratings?: {
    [key: string]: any;
  };
  stats?: any;
  allStats?: any;
}

export interface DraftPick {
  year: number;
  round: number;
  overall: number;
  originalTeam: string;
  currentOwner: string;
  status: string;
  draftedPlayer: string;
  timestamp: string;
  via: string | null;
  history?: string;
}