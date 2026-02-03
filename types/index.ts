export interface Team {
  name: string;
  short: string;
  lastSync?: string;
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

export interface StandingRow {
  year: string | number;
  team: string;
  teamshort?: string;
  gm?: string;
  won: number;
  lost: number;
  tie: number;
  pct: number;
  offPts: number;
  defPts: number;
  diff: number;
  division?: string;
  isChampion?: boolean | string | number;
  isPlayoff?: boolean | string | number;
}