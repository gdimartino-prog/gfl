export interface ScheduleGame {
  id?: number;
  year?: string | number | null;
  status?: string;
  home?: string | null;
  visitor?: string | null;
  hScore?: string | number | null;
  vScore?: string | number | null;
  week?: string | number;
  isBye?: boolean | null;
}

export interface Team {
  name: string;
  short: string;
  team: string;
  teamshort: string;
  coach?: string;
  email?: string;
  mobile?: string;
  commissioner?: boolean;
  nickname?: string;
  status?: string;
  lastSync?: string;
}

export interface PlayerStats {
  games?: string | number;
  passing?: {
    att?: string | number;
    attempts?: string | number;
    comp?: string | number;
    completions?: string | number;
    yds?: string | number;
    yards?: string | number;
    int?: string | number;
    interceptions?: string | number;
    td?: string | number;
    tds?: string | number;
  };
  rushing?: {
    att?: string | number;
    attempts?: string | number;
    yds?: string | number;
    yards?: string | number;
    long?: string | number;
    td?: string | number;
    tds?: string | number;
  };
  receiving?: {
    receptions?: string | number;
    rec?: string | number;
    yds?: string | number;
    yards?: string | number;
    long?: string | number;
    td?: string | number;
    tds?: string | number;
  };
  defense?: {
    int?: string | number;
    interceptions?: string | number;
    tackles?: string | number;
    sacks?: string | number;
    stuffs?: string | number;
  };
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
    [key: string]: string | number | undefined;
  };
  dur?: string;
  run?: string;
  pass?: string;
  overall?: string | number;
  stats?: PlayerStats;
  allStats?: Record<string, string>;
}

export interface DraftPick {
  id: number;
  year: number;
  round: number;
  overall: number;
  originalTeam: string;
  currentOwner: string;
  currentOwnerCode?: string;
  status: string;
  draftedPlayer: string;
  timestamp: string;
  scheduledAt?: string | null;
  via: string | null;
  history?: string;
}

export interface StandingRow {
  year: string | number;
  team: string;
  teamshort?: string;
  short?: string;
  nickname?: string;
  coach?: string;
  gm?: string;
  won: number;
  lost: number;
  tie: number;
  pct: number;
  offPts: number;
  defPts: number;
  diff: number;
  division?: string;
  isDivWinner?: boolean;
  isPlayoff?: boolean;
  isSuperBowl?: boolean;
  isChampion?: boolean;
  oldTeamName?: string | null;
}