"use client";

import { useState, useEffect } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import Link from "next/link";
import { UploadCloud, File as FileIcon, X, Save, RefreshCw, UserCheck, UserX, Clock, Users, Plus, Pencil, ChevronDown, ChevronRight, CalendarDays, Trash2, Trophy, ClipboardList } from "lucide-react";

type RuleRow = { setting: string; value: string; desc: string | null; year: number | null };
const GLOBAL_ONLY_RULES = new Set(['cuts_year', 'current_nfl_week', 'player_sync']);
const isGlobalOnlyRule = (r: string) => GLOBAL_ONLY_RULES.has(r) || r.startsWith('draft_clock_');
type PendingSignup = { id: number; name: string; teamshort: string; coach: string; email: string | null; mobile: string | null; leagueId: number | null; touch_dt: string };
type TeamRow = { id: number; name: string; teamshort: string | null; coach: string | null; email: string | null; mobile: string | null; nickname: string | null; isCommissioner: boolean | null; status: string | null };
type TeamForm = { name: string; teamshort: string; coach: string; email: string; mobile: string; nickname: string; isCommissioner: boolean; status: string };
type GameRow = { id: number; year: number | null; week: string; homeTeamId: number; awayTeamId: number; home: string | null; visitor: string | null; hScore: number | null; vScore: number | null };
type GameForm = { year: string; week: string; homeTeamId: string; awayTeamId: string; hScore: string; vScore: string };
type AwardsRow = { id: number; teamId: number; teamName: string | null; teamshort: string | null; nickname: string | null; wins: number; losses: number; ties: number; division: string | null; offPts: number | null; defPts: number | null; isDivWinner: boolean | null; isPlayoff: boolean | null; isSuperBowl: boolean | null; isChampion: boolean | null };

const MaintenanceClient = ({ isSuperuser = false }: { isSuperuser?: boolean }) => {
  const [confirm, ConfirmDialog] = useConfirm();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [results, setResults] = useState<{ fileName: string; success: boolean; message: string }[]>([]);

  // Pending signups state
  const [pendingSignups, setPendingSignups] = useState<PendingSignup[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Section collapse state
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [teamStatusFilter, setTeamStatusFilter] = useState<'active' | 'inactive'>('active');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaguesOpen, setLeaguesOpen] = useState(false);

  // League manager state
  const [leaguesData, setLeaguesData] = useState<{ id: number; name: string; slug: string; legacyUrl: string | null }[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [newLeague, setNewLeague] = useState({ name: '', slug: '' });
  const [leagueMsg, setLeagueMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [editingLeagueId, setEditingLeagueId] = useState<number | null>(null);
  const [editLeagueForm, setEditLeagueForm] = useState({ name: '', slug: '', legacyUrl: '' });
  const [savingLeagueId, setSavingLeagueId] = useState<number | null>(null);

  // Team manager state
  const [teamsData, setTeamsData] = useState<TeamRow[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [teamForm, setTeamForm] = useState<TeamForm>({ name: '', teamshort: '', coach: '', email: '', mobile: '', nickname: '', isCommissioner: false, status: 'active' });
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamMsg, setTeamMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [resetPasswordTeamId, setResetPasswordTeamId] = useState<number | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordMsg, setResetPasswordMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false);

  // Schedule manager state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleYear, setScheduleYear] = useState('');
  const [scheduleGames, setScheduleGames] = useState<GameRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [editingGameId, setEditingGameId] = useState<number | null>(null);
  const [addingGame, setAddingGame] = useState(false);
  const [gameForm, setGameForm] = useState<GameForm>({ year: '', week: '', homeTeamId: '', awayTeamId: '', hScore: '', vScore: '' });
  const [gameSaving, setGameSaving] = useState(false);
  const [gameMsg, setGameMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [gameDeletingId, setGameDeletingId] = useState<number | null>(null);

  // Season Awards state
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [awardsYear, setAwardsYear] = useState('');
  const [awardsRows, setAwardsRows] = useState<AwardsRow[]>([]);
  const [awardsLoading, setAwardsLoading] = useState(false);
  const [awardsSaving, setAwardsSaving] = useState<number | null>(null);
  const [awardsMsg, setAwardsMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Resources manager state
  const [resourcesOpen, setResourcesOpen] = useState(false);
  type ResourceRow = { id: number; group: string | null; title: string; url: string | null; sortOrder: number };
  const [resourcesData, setResourcesData] = useState<ResourceRow[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null);
  const [addingResource, setAddingResource] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title: '', url: '', group: 'General', sortOrder: '0' });
  const [resourceSaving, setResourceSaving] = useState(false);
  const [resourceMsg, setResourceMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [deletingResourceId, setDeletingResourceId] = useState<number | null>(null);

  // Rules editor state
  const [rulesData, setRulesData] = useState<RuleRow[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [clearDraftYear, setClearDraftYear] = useState('');
  const [clearDraftType, setClearDraftType] = useState('free_agent');
  const [clearDraftLoading, setClearDraftLoading] = useState(false);
  const [clearDraftMsg, setClearDraftMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [draftStartDate, setDraftStartDate] = useState('');
  const [savingStartDate, setSavingStartDate] = useState(false);
  const [startDateMsg, setStartDateMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [ruleResults, setRuleResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [initializingRules, setInitializingRules] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [rulesYear, setRulesYear] = useState<string>('All');
  const [addingRule, setAddingRule] = useState(false);
  const [newRule, setNewRule] = useState({ setting: '', value: '', year: '', desc: '' });
  const [manualRuleEntry, setManualRuleEntry] = useState(false);
  const [addRuleMsg, setAddRuleMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [deletingRuleKey, setDeletingRuleKey] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
    fetchPendingSignups();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (rulesData.length > 0 && !scheduleYear) {
      const cutsYear = rulesData.find(r => r.setting.toLowerCase() === 'cuts_year')?.value;
      setScheduleYear(cutsYear ?? String(new Date().getFullYear()));
      setAwardsYear(cutsYear ?? String(new Date().getFullYear())); // also init awards year
    }
  }, [rulesData, scheduleYear]);

  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const res = await fetch('/api/admin/teams');
      if (res.ok) setTeamsData(await res.json());
    } catch {}
    finally { setTeamsLoading(false); }
  };

  const blankForm = (): TeamForm => ({ name: '', teamshort: '', coach: '', email: '', mobile: '', nickname: '', isCommissioner: false, status: 'active' });

  const startEdit = (team: TeamRow) => {
    setAddingTeam(false);
    setTeamMsg(null);
    setEditingTeamId(team.id);
    setTeamForm({ name: team.name, teamshort: team.teamshort ?? '', coach: team.coach ?? '', email: team.email ?? '', mobile: team.mobile ?? '', nickname: team.nickname ?? '', isCommissioner: team.isCommissioner ?? false, status: team.status ?? 'active' });
  };

  const startAdd = () => {
    setEditingTeamId(null);
    setTeamMsg(null);
    setAddingTeam(true);
    setTeamForm(blankForm());
  };

  const cancelTeam = () => { setEditingTeamId(null); setAddingTeam(false); setTeamMsg(null); };

  const fetchScheduleGames = async (year: string) => {
    setScheduleLoading(true);
    setScheduleGames([]);
    try {
      const res = await fetch(`/api/admin/schedule?year=${encodeURIComponent(year)}`);
      if (res.ok) setScheduleGames(await res.json());
    } catch {}
    finally { setScheduleLoading(false); }
  };

  const blankGameForm = (): GameForm => ({ year: scheduleYear, week: '', homeTeamId: '', awayTeamId: '', hScore: '', vScore: '' });

  const startEditGame = (game: GameRow) => {
    setAddingGame(false);
    setGameMsg(null);
    setEditingGameId(game.id);
    setGameForm({
      year: game.year != null ? String(game.year) : scheduleYear,
      week: String(game.week),
      homeTeamId: String(game.homeTeamId),
      awayTeamId: String(game.awayTeamId),
      hScore: game.hScore != null ? String(game.hScore) : '',
      vScore: game.vScore != null ? String(game.vScore) : '',
    });
  };

  const startAddGame = () => {
    setEditingGameId(null);
    setGameMsg(null);
    setAddingGame(true);
    setGameForm(blankGameForm());
  };

  const handleClearDraft = async () => {
    if (!clearDraftYear) return setClearDraftMsg({ success: false, text: 'Enter a draft year.' });
    if (!await confirm(`Clear ALL selections for the ${clearDraftYear} ${clearDraftType === 'free_agent' ? 'Free Agent' : 'Rookie'} draft? This cannot be undone.`, { title: 'Clear Draft', confirmLabel: 'Clear All', destructive: true })) return;
    setClearDraftLoading(true);
    setClearDraftMsg(null);
    const res = await fetch('/api/draft-picks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearAll: true, year: clearDraftYear, draftType: clearDraftType }),
    });
    const data = await res.json().catch(() => ({}));
    setClearDraftMsg(res.ok ? { success: true, text: 'Draft cleared successfully.' } : { success: false, text: data.error || 'Clear failed.' });
    setClearDraftLoading(false);
  };

  const handleSaveDraftStartDate = async () => {
    setSavingStartDate(true);
    setStartDateMsg(null);
    try {
      const isoValue = draftStartDate ? new Date(draftStartDate).toISOString() : '';
      const res = await fetch('/api/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: 'draft_start_date', value: isoValue, year: null }),
      });
      const data = await res.json();
      setStartDateMsg(res.ok ? { success: true, text: isoValue ? 'Draft start date saved.' : 'Draft start date cleared.' } : { success: false, text: data.error || 'Save failed.' });
    } catch {
      setStartDateMsg({ success: false, text: 'Error saving.' });
    } finally {
      setSavingStartDate(false);
    }
  };

  const cancelGame = () => { setEditingGameId(null); setAddingGame(false); setGameMsg(null); };

  const handleSaveGame = async () => {
    if (!gameForm.week || !gameForm.homeTeamId || !gameForm.awayTeamId) {
      setGameMsg({ success: false, text: 'Week, home team, and away team are required.' });
      return;
    }
    setGameSaving(true);
    setGameMsg(null);
    try {
      const method = addingGame ? 'POST' : 'PATCH';
      const body = addingGame
        ? { year: gameForm.year || null, week: gameForm.week, homeTeamId: gameForm.homeTeamId, awayTeamId: gameForm.awayTeamId, hScore: gameForm.hScore, vScore: gameForm.vScore }
        : { id: editingGameId, year: gameForm.year || null, week: gameForm.week, homeTeamId: gameForm.homeTeamId, awayTeamId: gameForm.awayTeamId, hScore: gameForm.hScore, vScore: gameForm.vScore };
      const res = await fetch('/api/admin/schedule', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setGameMsg({ success: true, text: addingGame ? 'Game added.' : 'Game updated.' });
        await fetchScheduleGames(scheduleYear);
        setEditingGameId(null);
        setAddingGame(false);
      } else {
        const d = await res.json();
        setGameMsg({ success: false, text: d.error || 'Failed to save.' });
      }
    } catch {
      setGameMsg({ success: false, text: 'Error saving game.' });
    } finally {
      setGameSaving(false);
    }
  };

  const handleDeleteGame = async (id: number) => {
    if (!await confirm('Delete this game?', { confirmLabel: 'Delete', destructive: true })) return;
    setGameDeletingId(id);
    try {
      const res = await fetch('/api/admin/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (res.ok) setScheduleGames(prev => prev.filter(g => g.id !== id));
    } catch {}
    finally { setGameDeletingId(null); }
  };

  const fetchAwards = async (year: string) => {
    if (!year) return;
    setAwardsLoading(true);
    setAwardsRows([]);
    setAwardsMsg(null);
    try {
      const res = await fetch(`/api/admin/standings?year=${encodeURIComponent(year)}`);
      if (res.ok) {
        const data = await res.json();
        setAwardsRows(data);
        if (data.length === 0) setAwardsMsg({ success: false, text: `No standings data found for ${year}. Upload standings first.` });
      } else {
        const err = await res.json().catch(() => ({}));
        setAwardsMsg({ success: false, text: err.error || `Error ${res.status}` });
      }
    } catch (e) {
      setAwardsMsg({ success: false, text: 'Network error loading standings.' });
    }
    finally { setAwardsLoading(false); }
  };

  const handleAwardsFlag = (id: number, field: keyof AwardsRow, value: boolean) => {
    setAwardsRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSaveAwards = async (row: AwardsRow) => {
    setAwardsSaving(row.id);
    setAwardsMsg(null);
    try {
      const res = await fetch('/api/admin/standings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, isDivWinner: row.isDivWinner, isPlayoff: row.isPlayoff, isSuperBowl: row.isSuperBowl, isChampion: row.isChampion }),
      });
      if (res.ok) {
        setAwardsMsg({ success: true, text: `${row.teamName} saved.` });
      } else {
        setAwardsMsg({ success: false, text: 'Failed to save.' });
      }
    } catch {
      setAwardsMsg({ success: false, text: 'Error saving.' });
    } finally {
      setAwardsSaving(null);
    }
  };

  const fetchResources = async () => {
    setResourcesLoading(true);
    try {
      const res = await fetch('/api/admin/resources');
      if (res.ok) setResourcesData(await res.json());
    } catch {}
    finally { setResourcesLoading(false); }
  };

  const handleSaveResource = async () => {
    if (!resourceForm.title.trim()) { setResourceMsg({ success: false, text: 'Title is required.' }); return; }
    setResourceSaving(true);
    setResourceMsg(null);
    try {
      const method = addingResource ? 'POST' : 'PATCH';
      const body = addingResource ? resourceForm : { id: editingResourceId, ...resourceForm };
      const res = await fetch('/api/admin/resources', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setResourceMsg({ success: true, text: addingResource ? 'Resource added.' : 'Resource updated.' });
        await fetchResources();
        setEditingResourceId(null);
        setAddingResource(false);
      } else {
        const d = await res.json();
        setResourceMsg({ success: false, text: d.error || 'Failed to save.' });
      }
    } catch {
      setResourceMsg({ success: false, text: 'Error saving resource.' });
    } finally { setResourceSaving(false); }
  };

  const handleDeleteResource = async (id: number) => {
    if (!await confirm('Delete this resource?', { confirmLabel: 'Delete', destructive: true })) return;
    setDeletingResourceId(id);
    try {
      const res = await fetch('/api/admin/resources', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (res.ok) setResourcesData(prev => prev.filter(r => r.id !== id));
    } catch {}
    finally { setDeletingResourceId(null); }
  };

  const handleSaveTeam = async () => {
    if (!teamForm.name.trim() || !teamForm.teamshort.trim()) { setTeamMsg({ success: false, text: 'Name and Team Code are required.' }); return; }
    setTeamSaving(true);
    setTeamMsg(null);
    try {
      const method = addingTeam ? 'POST' : 'PATCH';
      const body = addingTeam ? teamForm : { id: editingTeamId, ...teamForm };
      const res = await fetch('/api/admin/teams', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setTeamMsg({ success: true, text: addingTeam ? 'Team added.' : 'Team updated.' });
        await fetchTeams();
        setEditingTeamId(null);
        setAddingTeam(false);
      } else {
        const d = await res.json();
        setTeamMsg({ success: false, text: d.error || 'Failed to save.' });
      }
    } catch {
      setTeamMsg({ success: false, text: 'Error saving team.' });
    } finally {
      setTeamSaving(false);
    }
  };

  const handleResetPassword = async (teamId: number) => {
    if (!resetPasswordValue.trim()) { setResetPasswordMsg({ success: false, text: 'Enter a new password.' }); return; }
    setResetPasswordSaving(true);
    setResetPasswordMsg(null);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: teamId, newPassword: resetPasswordValue.trim() }),
      });
      if (res.ok) {
        setResetPasswordMsg({ success: true, text: 'Password updated.' });
        setResetPasswordValue('');
        setTimeout(() => { setResetPasswordTeamId(null); setResetPasswordMsg(null); }, 1500);
      } else {
        const d = await res.json();
        setResetPasswordMsg({ success: false, text: d.error || 'Failed.' });
      }
    } catch {
      setResetPasswordMsg({ success: false, text: 'Error.' });
    } finally {
      setResetPasswordSaving(false);
    }
  };

  const fetchPendingSignups = async () => {
    setPendingLoading(true);
    try {
      const res = await fetch('/api/signup');
      if (res.ok) setPendingSignups(await res.json());
    } catch {}
    finally { setPendingLoading(false); }
  };

  const handleSignupAction = async (id: number, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/signup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) setPendingSignups(prev => prev.filter(s => s.id !== id));
    } catch {}
    finally { setProcessingId(null); }
  };

  const handleInitializeRules = async () => {
    setInitializingRules(true);
    setInitMessage(null);
    try {
      const res = await fetch('/api/rules/initialize', { method: 'POST' });
      const data = await res.json();
      setInitMessage(data.message ?? (res.ok ? 'Done.' : 'Error'));
      if (data.created > 0) fetchRules();
    } catch {
      setInitMessage('Failed to initialize rules.');
    } finally {
      setInitializingRules(false);
    }
  };

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (Array.isArray(data)) {
        setRulesData(data);
        const initial: Record<string, string> = {};
        data.forEach((r: RuleRow) => { initial[`${r.setting}||${r.year ?? ''}`] = r.value; });
        setEditedValues(initial);
        // Pre-populate draft start date field (convert ISO → datetime-local format)
        const startDateRule = data.find((r: RuleRow) => r.setting === 'draft_start_date' && r.year == null);
        if (startDateRule?.value) {
          // datetime-local input needs "YYYY-MM-DDTHH:MM" format
          const d = new Date(startDateRule.value);
          if (!isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            setDraftStartDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchLeagues = async () => {
    setLeaguesLoading(true);
    try {
      const res = await fetch('/api/leagues');
      const data = await res.json();
      if (Array.isArray(data)) setLeaguesData(data);
    } catch {
      // ignore
    } finally {
      setLeaguesLoading(false);
    }
  };

  const handleCreateLeague = async () => {
    if (!newLeague.name.trim() || !newLeague.slug.trim()) return;
    setCreatingLeague(true);
    setLeagueMsg(null);
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLeague.name.trim(), slug: newLeague.slug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLeagueMsg({ success: false, text: data.error || 'Failed to create league' });
      } else {
        setLeagueMsg({ success: true, text: `League "${data.league.name}" created (ID: ${data.league.id})` });
        setNewLeague({ name: '', slug: '' });
        fetchLeagues();
      }
    } catch {
      setLeagueMsg({ success: false, text: 'Error creating league' });
    } finally {
      setCreatingLeague(false);
    }
  };

  const handleSaveLeague = async (id: number) => {
    if (!editLeagueForm.name.trim() && !editLeagueForm.slug.trim()) return;
    setSavingLeagueId(id);
    try {
      const res = await fetch('/api/leagues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editLeagueForm.name.trim(), slug: editLeagueForm.slug.trim(), legacyUrl: editLeagueForm.legacyUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update league');
      } else {
        setLeaguesData(prev => prev.map(lg => lg.id === id ? data.league : lg));
        setEditingLeagueId(null);
      }
    } catch {
      alert('Error updating league');
    } finally {
      setSavingLeagueId(null);
    }
  };

  const ruleKey = (setting: string, year: number | null) => `${setting}||${year ?? ''}`;

  const handleRuleChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
    setRuleResults(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSaveRule = async (row: RuleRow) => {
    const key = ruleKey(row.setting, row.year);
    setSavingRule(key);
    try {
      const res = await fetch('/api/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: row.setting, value: editedValues[key], year: row.year }),
      });
      const data = await res.json();
      if (res.ok) {
        setRuleResults(prev => ({ ...prev, [key]: { success: true, message: 'Saved' } }));
        setRulesData(prev => prev.map(r => ruleKey(r.setting, r.year) === key ? { ...r, value: editedValues[key] } : r));
      } else {
        setRuleResults(prev => ({ ...prev, [key]: { success: false, message: data.error || 'Failed' } }));
      }
    } catch {
      setRuleResults(prev => ({ ...prev, [key]: { success: false, message: 'Error saving' } }));
    } finally {
      setSavingRule(null);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.setting.trim() || !newRule.value.trim()) return;
    setAddRuleMsg(null);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: newRule.setting.trim(), value: newRule.value.trim(), year: newRule.year || null, desc: newRule.desc || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddRuleMsg({ success: true, text: 'Rule added' });
        setNewRule({ setting: '', value: '', year: '', desc: '' });
        setAddingRule(false);
        await fetchRules();
      } else {
        setAddRuleMsg({ success: false, text: data.error || 'Failed' });
      }
    } catch {
      setAddRuleMsg({ success: false, text: 'Error' });
    }
  };

  const handleDeleteRule = async (row: RuleRow) => {
    const label = row.year ? `${row.setting} (${row.year})` : `${row.setting} (Global)`;
    if (!await confirm(`Delete rule "${label}"? This cannot be undone.`, { confirmLabel: 'Delete', destructive: true })) return;
    const key = ruleKey(row.setting, row.year);
    setDeletingRuleKey(key);
    try {
      await fetch('/api/rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: row.setting, year: row.year }),
      });
      setRulesData(prev => prev.filter(r => ruleKey(r.setting, r.year) !== key));
    } finally {
      setDeletingRuleKey(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prevFiles => [...prevFiles, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      setFiles(prevFiles => [...prevFiles, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (files.length === 0) { alert("Please select one or more files to upload."); return; }

    // Pre-count rows in CSV files for the total display
    const counts: Record<string, number> = {};
    await Promise.all(files.map(async file => {
      if (!file.name.toLowerCase().endsWith('.csv')) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('team,'));
      counts[file.name] = lines.length;
    }));
    setFileCounts(counts);
    setProgressCurrent(0);
    setProgressTotal(Object.values(counts).reduce((a, b) => a + b, 0));

    setUploading(true);
    setResults([]);

    const formData = new FormData();
    files.forEach(file => formData.append("files", file));

    try {
      const response = await fetch("/api/maintenance/stream", { method: "POST", body: formData });
      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({}));
        alert(`Upload failed: ${err.message || err.error || 'Unknown error'}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const fileResults: { fileName: string; success: boolean; message: string }[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'progress') {
              setProgressCurrent(event.current);
            } else if (event.type === 'file_done') {
              fileResults.push({ fileName: event.file, success: event.success, message: event.message });
            }
          } catch { /* ignore malformed lines */ }
        }
      }

      setResults(fileResults);
    } finally {
      setUploading(false);
      setFiles([]);
      setFileCounts({});
      setProgressCurrent(0);
      setProgressTotal(0);
    }
  };

  const seasonGames = parseInt(rulesData.find(r => r.setting.toLowerCase() === 'season_games')?.value ?? '') || 14;
  const weekOptions = [...Array.from({ length: seasonGames }, (_, i) => String(i + 1)), 'WC', 'CONF', 'SB'];

  const isDirty = (row: RuleRow) => {
    const key = ruleKey(row.setting, row.year);
    const original = rulesData.find(r => ruleKey(r.setting, r.year) === key)?.value ?? '';
    return editedValues[key] !== original;
  };

  return (
    <div className="space-y-10">
      <ConfirmDialog />
      {/* File Upload Section */}
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="file-upload"
          data-testid="dropzone"
          className={`relative block w-full rounded-[2rem] p-8 border-2 border-dashed text-center cursor-pointer transition-all ${
            dragging ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <UploadCloud className="mx-auto text-blue-600 mb-4" size={48} />
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
            Upload <span className="text-blue-600">League Files</span>
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 mb-6">
            Upload Standings, Schedule, Players, etc.
          </p>
          <input id="file-upload" name="file-upload" type="file" multiple onChange={handleFileChange} className="hidden" />
        </label>

        {files.length > 0 && (
          <div className="mt-6">
            <h4 className="text-lg font-bold">Selected Files:</h4>
            <ul className="mt-2 space-y-2">
              {files.map((file, index) => {
                const count = fileCounts[file.name];
                return (
                  <li key={index} className="flex items-center justify-between p-2 bg-slate-100 rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="h-5 w-5 shrink-0 text-slate-500" />
                      <span className="text-sm text-slate-700 truncate">{file.name}</span>
                      {uploading && count !== undefined && (
                        <span className="shrink-0 text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">
                          {progressTotal > 0
                            ? `${progressCurrent.toLocaleString()} / ${count.toLocaleString()}`
                            : `${count.toLocaleString()} records…`}
                        </span>
                      )}
                    </div>
                    {!uploading && (
                      <button onClick={() => removeFile(index)} className="p-1 rounded-full hover:bg-slate-200">
                        <X className="h-4 w-4 text-slate-500" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={files.length === 0 || uploading}
          className={`w-full mt-6 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
            files.length === 0 ? "bg-slate-100 text-slate-300" : "bg-slate-900 text-white shadow-xl hover:bg-blue-600"
          }`}
        >
          {uploading
            ? progressTotal > 0
              ? `Processing ${progressCurrent.toLocaleString()} of ${progressTotal.toLocaleString()} records…`
              : 'Processing…'
            : `Synchronize ${files.length} File(s)`}
        </button>
      </form>

      {results.length > 0 && (
        <div>
          <h4 className="text-lg font-bold">Upload Results:</h4>
          <ul className="mt-2 space-y-2">
            {results.map((result, index) => (
              <li key={index} className={`p-2 rounded-md ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <strong>{result.fileName}:</strong> {result.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pending Signups Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <div className="px-8 py-5 bg-slate-900 flex items-center justify-between">
          <div>
            <h3 className="text-white font-black uppercase italic tracking-tighter text-lg flex items-center gap-2">
              <Clock size={18} className="text-amber-400" /> Pending Signups
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">New coach applications awaiting approval</p>
          </div>
          <button
            onClick={fetchPendingSignups}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {pendingLoading ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading...</div>
        ) : pendingSignups.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">No pending applications.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingSignups.map(signup => (
              <div key={signup.id} className="flex items-center gap-4 px-8 py-5 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-500 font-mono text-[10px] px-2 py-1 rounded font-black">{signup.teamshort}</span>
                    <p className="font-black text-slate-900 uppercase italic tracking-tight">{signup.name}</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-1">{signup.coach}{signup.email ? ` • ${signup.email}` : ''}{signup.mobile ? ` • ${signup.mobile}` : ''}</p>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">League ID: {signup.leagueId} • Applied {new Date(signup.touch_dt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleSignupAction(signup.id, 'approve')}
                    disabled={processingId === signup.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    <UserCheck size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleSignupAction(signup.id, 'reject')}
                    disabled={processingId === signup.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-100 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-200 transition-all disabled:opacity-50"
                  >
                    <UserX size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Draft Setup Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <div className="px-8 py-5 bg-slate-900 flex items-center justify-between">
          <div className="text-left">
            <h3 className="text-white font-black uppercase italic tracking-tighter text-lg flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-400" /> Draft Setup
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Generate draft pick order for a new season</p>
          </div>
          <Link href="/draft/setup"
            className="px-6 py-2.5 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">
            Open Setup Wizard →
          </Link>
        </div>
        <div className="px-8 py-6 border-t border-slate-100 space-y-6">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Official Draft Start Date</p>
            <p className="text-[10px] text-slate-400 mb-3">The draft clock will not run until this date/time. Teams can still submit picks early, but no auto-expiry fires before it.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date &amp; Time (local)</label>
                <input
                  type="datetime-local"
                  value={draftStartDate}
                  onChange={e => setDraftStartDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <button
                onClick={handleSaveDraftStartDate}
                disabled={savingStartDate}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                <Save size={13} /> {savingStartDate ? 'Saving…' : 'Save'}
              </button>
              {draftStartDate && (
                <button
                  onClick={() => { setDraftStartDate(''); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
            {startDateMsg && (
              <p className={`mt-2 text-xs font-bold ${startDateMsg.success ? 'text-green-600' : 'text-red-500'}`}>{startDateMsg.text}</p>
            )}
          </div>
          <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Clear Draft Selections</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Year</label>
              <input
                type="number"
                value={clearDraftYear}
                onChange={e => setClearDraftYear(e.target.value)}
                placeholder="e.g. 2026"
                className="w-28 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</label>
              <select
                value={clearDraftType}
                onChange={e => setClearDraftType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="free_agent">Free Agent</option>
                <option value="rookie">Rookie</option>
              </select>
            </div>
            <button
              onClick={handleClearDraft}
              disabled={clearDraftLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
            >
              <Trash2 size={13} /> {clearDraftLoading ? 'Clearing…' : 'Clear Draft'}
            </button>
          </div>
          {clearDraftMsg && (
            <p className={`mt-3 text-xs font-bold ${clearDraftMsg.success ? 'text-green-600' : 'text-red-500'}`}>{clearDraftMsg.text}</p>
          )}
          </div>
        </div>
      </div>

      {/* Team Manager Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <button
          onClick={() => setTeamsOpen(o => !o)}
          className="w-full px-8 py-5 bg-slate-900 flex items-center justify-between hover:bg-slate-800 transition-colors"
        >
          <div className="text-left">
            <h3 className="text-white font-black uppercase italic tracking-tighter text-lg flex items-center gap-2">
              <Users size={18} className="text-blue-400" /> Team Manager
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Add or edit teams in this league</p>
          </div>
          {teamsOpen ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
        </button>

        {teamsOpen && (<>
        <div className="px-8 py-4 bg-slate-800 flex items-center justify-between gap-4 border-b border-slate-700">
          <div className="flex gap-1">
            {(['active', 'inactive'] as const).map(s => (
              <button
                key={s}
                onClick={() => setTeamStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  teamStatusFilter === s
                    ? s === 'active' ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
                    : 'bg-white/10 text-slate-400 hover:text-white'
                }`}
              >{s}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={startAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/80 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">
              <Plus size={14} /> Add Team
            </button>
            <button onClick={fetchTeams} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Add Team Form */}
        {addingTeam && (
          <div className="px-8 py-6 bg-blue-50 border-b border-blue-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-4">New Team</p>
            <TeamFormFields form={teamForm} onChange={setTeamForm} />
            <div className="flex items-center gap-3 mt-4">
              <button onClick={handleSaveTeam} disabled={teamSaving} className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all">
                <Plus size={13} /> {teamSaving ? 'Saving...' : 'Add Team'}
              </button>
              <button onClick={cancelTeam} className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all">Cancel</button>
              {teamMsg && <span className={`text-[10px] font-black uppercase tracking-widest ${teamMsg.success ? 'text-emerald-600' : 'text-red-600'}`}>{teamMsg.text}</span>}
            </div>
          </div>
        )}

        {teamsLoading ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading...</div>
        ) : teamsData.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">No teams found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {teamsData.filter(t => t.status === teamStatusFilter).map(team => (
              <div key={team.id}>
                {editingTeamId === team.id ? (
                  <div className="px-8 py-6 bg-amber-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-4">Editing: {team.name}</p>
                    <TeamFormFields form={teamForm} onChange={setTeamForm} />
                    <div className="flex items-center gap-3 mt-4">
                      <button onClick={handleSaveTeam} disabled={teamSaving} className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all">
                        <Save size={13} /> {teamSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={cancelTeam} className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all">Cancel</button>
                      {teamMsg && <span className={`text-[10px] font-black uppercase tracking-widest ${teamMsg.success ? 'text-emerald-600' : 'text-red-600'}`}>{teamMsg.text}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col px-8 py-4 hover:bg-slate-50 transition-colors gap-2">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100 text-slate-500 font-mono text-[10px] px-2 py-1 rounded font-black">{team.teamshort}</span>
                          <p className="font-black text-slate-900 uppercase italic tracking-tight">{team.name}</p>
                          {team.isCommissioner && <span className="text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Commissioner</span>}
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${team.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{team.status}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">{team.coach || '—'}{team.email ? ` • ${team.email}` : ''}{team.mobile ? ` • ${team.mobile}` : ''}</p>
                      </div>
                      <button onClick={() => startEdit(team)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all shrink-0">
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => { setResetPasswordTeamId(resetPasswordTeamId === team.id ? null : team.id); setResetPasswordValue(''); setResetPasswordMsg(null); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-100 text-amber-700 font-black text-[10px] uppercase tracking-widest hover:bg-amber-200 transition-all shrink-0"
                      >
                        Reset PW
                      </button>
                    </div>
                    {resetPasswordTeamId === team.id && (
                      <div className="flex items-center gap-3 pl-2 pb-1">
                        <input
                          type="password"
                          placeholder="New password"
                          value={resetPasswordValue}
                          onChange={e => setResetPasswordValue(e.target.value)}
                          className="px-3 py-2 rounded-xl border-2 border-amber-300 bg-white text-sm font-bold text-slate-800 outline-none focus:border-amber-500 transition-all w-48"
                        />
                        <button onClick={() => handleResetPassword(team.id)} disabled={resetPasswordSaving} className="px-4 py-2 rounded-xl bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 disabled:opacity-50 transition-all">
                          {resetPasswordSaving ? 'Saving...' : 'Set Password'}
                        </button>
                        <button onClick={() => { setResetPasswordTeamId(null); setResetPasswordValue(''); setResetPasswordMsg(null); }} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all">
                          Cancel
                        </button>
                        {resetPasswordMsg && <span className={`text-[10px] font-black uppercase tracking-widest ${resetPasswordMsg.success ? 'text-emerald-600' : 'text-red-600'}`}>{resetPasswordMsg.text}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </>)}
      </div>

      {/* Schedule Manager Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <button
          onClick={() => { const opening = !scheduleOpen; setScheduleOpen(opening); if (opening && scheduleGames.length === 0) fetchScheduleGames(scheduleYear); }}
          className="w-full px-8 py-5 bg-slate-900 flex items-center justify-between hover:bg-slate-800 transition-colors"
        >
          <div className="text-left">
            <h3 className="text-white font-black uppercase italic tracking-tighter text-lg flex items-center gap-2">
              <CalendarDays size={18} className="text-blue-400" /> Schedule Manager
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Add or edit games for any season</p>
          </div>
          {scheduleOpen ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
        </button>

        {scheduleOpen && (<>
        <div className="px-8 py-4 bg-slate-800 flex items-center gap-3 border-b border-slate-700">
          <input
            type="number"
            value={scheduleYear}
            onChange={e => setScheduleYear(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchScheduleGames(scheduleYear)}
            placeholder="Year"
            className="w-28 px-3 py-2 rounded-xl bg-white/10 text-white text-sm font-bold border border-slate-600 outline-none focus:border-blue-400 transition-all"
          />
          <div className="flex-1" />
          <button onClick={startAddGame} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/80 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">
            <Plus size={14} /> Add Game
          </button>
          <button onClick={() => fetchScheduleGames(scheduleYear)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {addingGame && (
          <div className="px-8 py-6 bg-blue-50 border-b border-blue-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-4">New Game</p>
            <GameFormFields form={gameForm} onChange={setGameForm} teams={teamsData} weekOptions={weekOptions} />
            <div className="flex items-center gap-3 mt-4">
              <button onClick={handleSaveGame} disabled={gameSaving} className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all">
                <Plus size={13} /> {gameSaving ? 'Saving...' : 'Add Game'}
              </button>
              <button onClick={cancelGame} className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all">Cancel</button>
              {gameMsg && <span className={`text-[10px] font-black uppercase tracking-widest ${gameMsg.success ? 'text-emerald-600' : 'text-red-600'}`}>{gameMsg.text}</span>}
            </div>
          </div>
        )}

        {scheduleLoading ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading...</div>
        ) : scheduleGames.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">No games found. Enter a year and click Load.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {scheduleGames.map(game => (
              <div key={game.id}>
                {editingGameId === game.id ? (
                  <div className="px-8 py-6 bg-amber-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-4">Editing — Wk {game.week}: {game.home} vs {game.visitor}</p>
                    <GameFormFields form={gameForm} onChange={setGameForm} teams={teamsData} weekOptions={weekOptions} />
                    <div className="flex items-center gap-3 mt-4">
                      <button onClick={handleSaveGame} disabled={gameSaving} className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all">
                        <Save size={13} /> {gameSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={cancelGame} className="px-5 py-2 rounded-xl bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all">Cancel</button>
                      {gameMsg && <span className={`text-[10px] font-black uppercase tracking-widest ${gameMsg.success ? 'text-emerald-600' : 'text-red-600'}`}>{gameMsg.text}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-8 py-3 hover:bg-slate-50 transition-colors">
                    <div className="w-12 shrink-0 text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Wk {game.week}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-sm uppercase italic tracking-tight">
                        {game.home ?? '?'} <span className="text-slate-400 font-bold not-italic normal-case">vs</span> {game.visitor ?? '?'}
                      </p>
                    </div>
                    <div className="w-20 shrink-0 text-center">
                      {(game.hScore != null && game.vScore != null)
                        ? <span className="text-sm font-black text-slate-900">{game.hScore}–{game.vScore}</span>
                        : <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">—</span>
                      }
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => startEditGame(game)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGame(game.id)}
                        disabled={gameDeletingId === game.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Del
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </>)}
      </div>

      {/* Season Awards Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <button
          onClick={() => { const opening = !awardsOpen; setAwardsOpen(opening); if (opening && awardsRows.length === 0 && awardsYear) fetchAwards(awardsYear); }}
          className="w-full px-8 py-5 bg-slate-900 flex items-center justify-between hover:bg-slate-800 transition-colors"
        >
          <div className="text-left">
            <h3 className="text-white font-black uppercase italic tracking-tighter text-lg flex items-center gap-2">
              <Trophy size={18} className="text-amber-400" /> Season Awards
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Set playoffs, division winners &amp; champions per season</p>
          </div>
          {awardsOpen ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
        </button>

        {awardsOpen && (<>
        <div className="px-8 py-4 bg-slate-800 flex items-center gap-3 border-b border-slate-700">
          <input
            type="number"
            value={awardsYear}
            onChange={e => setAwardsYear(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchAwards(awardsYear)}
            placeholder="Year e.g. 2025"
            className="w-36 px-3 py-2 rounded-xl bg-white/10 text-white text-sm font-bold border border-slate-600 outline-none focus:border-blue-400 transition-all"
          />
          <button
            onClick={() => fetchAwards(awardsYear)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/80 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
          >
            Load
          </button>
          <button
            onClick={() => fetchAwards(awardsYear)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {awardsMsg && (
            <span className={`text-[10px] font-black uppercase tracking-widest ${awardsMsg.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {awardsMsg.text}
            </span>
          )}
        </div>

        {awardsLoading ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading...</div>
        ) : awardsRows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">Enter a year and click Load.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
                  <th className="px-6 py-3">Team</th>
                  <th className="px-4 py-3 text-center">W-L-T</th>
                  <th className="px-4 py-3 text-center">Div Win</th>
                  <th className="px-4 py-3 text-center">Playoff</th>
                  <th className="px-4 py-3 text-center">Super Bowl</th>
                  <th className="px-4 py-3 text-center">Champion</th>
                  <th className="px-4 py-3 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {awardsRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-500 font-mono text-[10px] px-2 py-0.5 rounded font-black">{row.teamshort}</span>
                        <span className="font-black text-slate-900 uppercase italic tracking-tight text-sm">{row.teamName} {row.nickname}</span>
                        {row.division && <span className="text-[9px] font-black text-slate-400 uppercase">{row.division}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-black text-slate-700">{row.wins}-{row.losses}-{row.ties}</td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!row.isDivWinner} onChange={e => handleAwardsFlag(row.id, 'isDivWinner', e.target.checked)} className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!row.isPlayoff} onChange={e => handleAwardsFlag(row.id, 'isPlayoff', e.target.checked)} className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!row.isSuperBowl} onChange={e => handleAwardsFlag(row.id, 'isSuperBowl', e.target.checked)} className="w-4 h-4 rounded text-amber-500 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!row.isChampion} onChange={e => handleAwardsFlag(row.id, 'isChampion', e.target.checked)} className="w-4 h-4 rounded text-amber-500 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSaveAwards(row)}
                        disabled={awardsSaving === row.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all ml-auto"
                      >
                        <Save size={12} /> {awardsSaving === row.id ? '...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>)}
      </div>

      {/* Resources Manager Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <button
          onClick={() => { const opening = !resourcesOpen; setResourcesOpen(opening); if (opening && resourcesData.length === 0) fetchResources(); }}
          className="w-full px-8 py-5 bg-slate-900 flex items-center justify-between hover:bg-slate-800 transition-colors"
        >
          <div className="text-left">
            <h3 className="text-white font-black uppercase italic tracking-tighter text-lg">Resources</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Links &amp; Documents</p>
          </div>
          {resourcesOpen ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
        </button>
        {resourcesOpen && (<>
          <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between">
            {resourceMsg && <p className={`text-xs font-bold ${resourceMsg.success ? 'text-emerald-600' : 'text-red-500'}`}>{resourceMsg.text}</p>}
            {!addingResource && !editingResourceId && (
              <button onClick={() => { setAddingResource(true); setEditingResourceId(null); setResourceMsg(null); setResourceForm({ title: '', url: '', group: 'General', sortOrder: '' }); }} className="ml-auto flex items-center gap-2 bg-slate-900 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors">
                <Plus size={14} /> Add Resource
              </button>
            )}
          </div>

          {(addingResource || editingResourceId !== null) && (
            <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3">
              <input placeholder="Title *" value={resourceForm.title} onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900" />
              <input placeholder="URL (optional)" value={resourceForm.url} onChange={e => setResourceForm(f => ({ ...f, url: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900" />
              <input placeholder="Group (e.g. General)" value={resourceForm.group} onChange={e => setResourceForm(f => ({ ...f, group: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900" />
              <input type="number" placeholder="Order (0, 1, 2…)" value={resourceForm.sortOrder} onChange={e => setResourceForm(f => ({ ...f, sortOrder: e.target.value }))} className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900" />
              <div className="md:col-span-3 flex gap-2 justify-end">
                <button onClick={() => { setAddingResource(false); setEditingResourceId(null); setResourceMsg(null); }} className="text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">Cancel</button>
                <button onClick={handleSaveResource} disabled={resourceSaving} className="bg-blue-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {resourceSaving ? 'Saving...' : addingResource ? 'Add' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {resourcesLoading ? (
            <div className="px-8 py-6 text-slate-400 text-sm font-bold animate-pulse">Loading...</div>
          ) : resourcesData.length === 0 ? (
            <div className="px-8 py-6 text-slate-400 text-sm font-bold">No resources yet.</div>
          ) : (
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-6 py-3 w-12 text-center">#</th>
                <th className="px-6 py-3">Group</th>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">URL</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {resourcesData.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-xs font-black text-slate-400 text-center">{r.sortOrder}</td>
                    <td className="px-6 py-3 text-xs font-bold text-slate-500">{r.group || 'General'}</td>
                    <td className="px-6 py-3 text-sm font-black text-slate-900">{r.title}</td>
                    <td className="px-6 py-3 text-xs text-blue-500 truncate max-w-xs">
                      {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.url}</a> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditingResourceId(r.id); setAddingResource(false); setResourceMsg(null); setResourceForm({ title: r.title, url: r.url || '', group: r.group || 'General', sortOrder: String(r.sortOrder ?? 0) }); }} className="text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteResource(r.id)} disabled={deletingResourceId === r.id} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>)}
      </div>

      {/* Rules Editor Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
        <button
          onClick={() => setRulesOpen(o => !o)}
          className="w-full px-8 py-5 bg-slate-900 flex items-center justify-between hover:bg-slate-800 transition-colors"
        >
          <div className="text-left">
            <h3 className="text-white font-black uppercase italic tracking-tighter text-lg">League Settings</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Rules &amp; Configuration Values</p>
          </div>
          {rulesOpen ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
        </button>

        {rulesOpen && (<>
        <div className="px-8 py-4 bg-slate-800 flex items-center justify-between gap-2 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year:</span>
            <select
              value={rulesYear}
              onChange={e => setRulesYear(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-white text-[10px] rounded-lg px-3 py-2 font-bold cursor-pointer outline-none"
            >
              <option value="All">All</option>
              <option value="Global">Global</option>
              {Array.from(new Set(rulesData.map(r => r.year).filter((y): y is number => y != null))).sort((a, b) => b - a).map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setAddingRule(o => !o); setAddRuleMsg(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/80 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all"
            >
              <Plus size={14} /> Add Rule
            </button>
            <button
              onClick={handleInitializeRules}
              disabled={initializingRules}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/80 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 disabled:opacity-50 transition-all"
              title="Create any missing default rules for this league"
            >
              {initializingRules ? 'Creating...' : '+ Init Defaults'}
            </button>
            <button
              onClick={fetchRules}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
        {initMessage && (
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-8 py-2 bg-slate-800">{initMessage}</p>
        )}

        {addingRule && (
          <div className="px-8 py-5 bg-emerald-50 border-b border-emerald-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-3">New Year-Specific Rule</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Rule</label>
                {manualRuleEntry ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="rule_name"
                      value={newRule.setting}
                      onChange={e => setNewRule(r => ({ ...r, setting: e.target.value }))}
                      className="px-3 py-2 rounded-xl border-2 border-amber-300 text-sm font-bold w-48 outline-none focus:border-emerald-400"
                      autoFocus
                    />
                    <button onClick={() => { setManualRuleEntry(false); setNewRule(r => ({ ...r, setting: '', desc: '' })); }}
                      className="px-2 py-1 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black hover:bg-slate-200 transition-all">
                      ↩
                    </button>
                  </div>
                ) : (
                  <select
                    value={newRule.setting}
                    onChange={e => {
                      if (e.target.value === '__manual__') {
                        setManualRuleEntry(true);
                        setNewRule(r => ({ ...r, setting: '', desc: '' }));
                        return;
                      }
                      const selected = rulesData.find(r => r.year == null && r.setting === e.target.value);
                      const draftClockMatch = e.target.value.match(/^draft_clock_round_(\d+)$/);
                      const autoDesc = draftClockMatch ? `Draft clock duration for round ${draftClockMatch[1]}+ (minutes). Rounds without their own rule inherit the nearest lower configured round.` : '';
                      setNewRule(r => ({ ...r, setting: e.target.value, desc: selected?.desc ?? autoDesc }));
                    }}
                    className="px-3 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold w-48 outline-none focus:border-emerald-400 bg-white"
                  >
                    <option value="">— Select rule —</option>
                    {rulesData.filter(r => r.year == null).map(r => (
                      <option key={r.setting} value={r.setting}>{r.setting}</option>
                    ))}
                    {(() => {
                      const existing = new Set(rulesData.filter(r => r.year == null).map(r => r.setting));
                      const presets = Array.from({ length: 10 }, (_, i) => `draft_clock_round_${i + 1}`).filter(k => !existing.has(k));
                      return presets.length > 0 ? (
                        <>
                          <option disabled>— Draft Clock Presets —</option>
                          {presets.map(k => <option key={k} value={k}>{k}</option>)}
                        </>
                      ) : null;
                    })()}
                    <option value="__manual__">— Type manually —</option>
                  </select>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Value</label>
                <input type="text" placeholder="e.g. 12" value={newRule.value}
                  onChange={e => setNewRule(r => ({ ...r, value: e.target.value }))}
                  className="px-3 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold w-32 outline-none focus:border-emerald-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Year</label>
                {isGlobalOnlyRule(newRule.setting) ? (
                  <span className="px-3 py-2 rounded-xl border-2 border-slate-100 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 text-center">Global Only</span>
                ) : (
                  <input type="number" placeholder="e.g. 2023" value={newRule.year}
                    onChange={e => setNewRule(r => ({ ...r, year: e.target.value }))}
                    className="px-3 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold w-28 outline-none focus:border-emerald-400" />
                )}
              </div>
              {newRule.desc && (
                <div className="flex flex-col gap-1 self-center">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</label>
                  <p className="text-[11px] font-bold text-slate-500 max-w-xs">{newRule.desc}</p>
                </div>
              )}
              <button onClick={handleAddRule}
                disabled={!newRule.setting.trim() || !newRule.value.trim() || (!newRule.year && !manualRuleEntry && !isGlobalOnlyRule(newRule.setting))}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-40 transition-all flex items-center gap-1.5">
                <Save size={13} /> Save
              </button>
              <button onClick={() => { setAddingRule(false); setNewRule({ setting: '', value: '', year: '', desc: '' }); setManualRuleEntry(false); }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                Cancel
              </button>
            </div>
            {addRuleMsg && <p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${addRuleMsg.success ? 'text-emerald-600' : 'text-red-600'}`}>{addRuleMsg.text}</p>}
          </div>
        )}

        {rulesLoading ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">
            Loading rules...
          </div>
        ) : rulesData.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">
            No rules found in database.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rulesData.filter(row => {
              if (rulesYear === 'All') return true;
              if (rulesYear === 'Global') return row.year == null;
              return row.year === parseInt(rulesYear);
            }).map((row) => {
              const key = ruleKey(row.setting, row.year);
              const dirty = isDirty(row);
              const feedback = ruleResults[key];
              return (
                <div key={key} className="flex items-center gap-4 px-8 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-900 text-sm uppercase italic tracking-tight">{row.setting}</p>
                      {row.year != null
                        ? <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-widest">{row.year}</span>
                        : <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 uppercase tracking-widest">Global</span>
                      }
                    </div>
                    {row.desc && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">{row.desc}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      type="text"
                      value={editedValues[key] ?? row.value}
                      onChange={(e) => handleRuleChange(key, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && dirty && handleSaveRule(row)}
                      className={`w-48 px-4 py-2 rounded-xl text-sm font-bold border-2 outline-none transition-all ${
                        dirty ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-slate-50 text-slate-700'
                      } focus:ring-2 focus:ring-blue-300`}
                    />
                    <button
                      onClick={() => handleSaveRule(row)}
                      disabled={!dirty || savingRule === key}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        dirty
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <Save size={13} />
                      {savingRule === key ? 'Saving...' : 'Save'}
                    </button>
                    {feedback && (
                      <span className={`text-[10px] font-black uppercase tracking-widest ${feedback.success ? 'text-emerald-600' : 'text-red-600'}`}>
                        {feedback.message}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteRule(row)}
                      disabled={deletingRuleKey === key}
                      className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Delete rule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>)}
      </div>

      {/* Leagues — superuser only */}
      {isSuperuser && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => { const opening = !leaguesOpen; setLeaguesOpen(opening); if (opening && leaguesData.length === 0) fetchLeagues(); }}
          className="w-full px-8 py-5 bg-slate-900 flex items-center justify-between hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-white font-black uppercase tracking-tight text-sm">Leagues</span>
            <span className="bg-purple-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Superuser</span>
          </div>
          {leaguesOpen ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
        </button>

        {leaguesOpen && (<>
          {/* Create League Form */}
          <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex items-end gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">League Name</label>
              <input
                type="text"
                placeholder="e.g. Gridiron Football League"
                value={newLeague.name}
                onChange={e => setNewLeague(l => ({ ...l, name: e.target.value }))}
                className="px-3 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold w-64 outline-none focus:border-purple-400 bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Slug (short code)</label>
              <input
                type="text"
                placeholder="e.g. gfl2"
                value={newLeague.slug}
                onChange={e => setNewLeague(l => ({ ...l, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="px-3 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold w-36 outline-none focus:border-purple-400 bg-white font-mono"
              />
            </div>
            <button
              onClick={handleCreateLeague}
              disabled={creatingLeague || !newLeague.name.trim() || !newLeague.slug.trim()}
              className="px-5 py-2 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              <Plus size={13} /> Create League
            </button>
            {leagueMsg && (
              <span className={`text-[10px] font-black uppercase tracking-widest ${leagueMsg.success ? 'text-emerald-600' : 'text-red-600'}`}>
                {leagueMsg.text}
              </span>
            )}
          </div>

          {/* Existing leagues list */}
          <div className="divide-y divide-slate-100">
            {leaguesLoading ? (
              <div className="px-8 py-6 text-slate-400 text-sm font-bold">Loading...</div>
            ) : leaguesData.length === 0 ? (
              <div className="px-8 py-6 text-slate-400 text-sm font-bold">No leagues found.</div>
            ) : leaguesData.map(lg => (
              <div key={lg.id} className="flex items-center gap-4 px-8 py-4 hover:bg-slate-50 transition-colors">
                <span className="text-[10px] font-black text-slate-400 w-8">#{lg.id}</span>
                {editingLeagueId === lg.id ? (
                  <>
                    <input
                      value={editLeagueForm.name}
                      onChange={e => setEditLeagueForm(f => ({ ...f, name: e.target.value }))}
                      className="px-3 py-1.5 rounded-xl border-2 border-purple-300 text-sm font-bold flex-1 outline-none focus:border-purple-500"
                      placeholder="League name"
                    />
                    <input
                      value={editLeagueForm.slug}
                      onChange={e => setEditLeagueForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      className="px-3 py-1.5 rounded-xl border-2 border-purple-300 text-sm font-bold font-mono w-28 outline-none focus:border-purple-500"
                      placeholder="slug"
                    />
                    <input
                      value={editLeagueForm.legacyUrl}
                      onChange={e => setEditLeagueForm(f => ({ ...f, legacyUrl: e.target.value }))}
                      className="px-3 py-1.5 rounded-xl border-2 border-purple-300 text-sm font-bold w-64 outline-none focus:border-purple-500"
                      placeholder="https://legacy-site-url"
                    />
                    <button
                      onClick={() => handleSaveLeague(lg.id)}
                      disabled={savingLeagueId === lg.id}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 disabled:opacity-40 transition-all flex items-center gap-1"
                    >
                      <Save size={12} /> Save
                    </button>
                    <button
                      onClick={() => setEditingLeagueId(null)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="font-bold text-slate-800 text-sm">{lg.name}</span>
                      {lg.legacyUrl
                        ? <a href={lg.legacyUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline font-mono truncate">{lg.legacyUrl}</a>
                        : <span className="text-[10px] text-slate-400 italic">No classic site URL set</span>
                      }
                    </div>
                    <span className="font-mono text-[11px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg shrink-0">{lg.slug.toUpperCase()}</span>
                    <button
                      onClick={() => { setEditingLeagueId(lg.id); setEditLeagueForm({ name: lg.name, slug: lg.slug, legacyUrl: lg.legacyUrl ?? '' }); }}
                      className="p-2 rounded-xl text-slate-300 hover:text-purple-600 hover:bg-purple-50 transition-all"
                      title="Edit league"
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>)}
      </div>
      )}
    </div>
  );
};

function TeamFormFields({ form, onChange }: { form: TeamForm; onChange: (f: TeamForm) => void }) {
  const field = (label: string, key: keyof TeamForm, placeholder?: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={form[key] as string}
        onChange={e => onChange({ ...form, [key]: e.target.value })}
        className="px-3 py-2 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
      />
    </div>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {field('Team Name *', 'name', 'Gotham City')}
      {field('Team Code *', 'teamshort', 'GC')}
      {field('Coach Name', 'coach', 'John Smith')}
      {field('Email', 'email', 'coach@example.com')}
      {field('Mobile', 'mobile', '555-555-5555')}
      {field('Nickname', 'nickname', 'Knights')}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Status</label>
        <select
          value={form.status}
          onChange={e => onChange({ ...form, status: e.target.value })}
          className="px-3 py-2 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        >
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="flex items-center gap-3 pt-5">
        <input
          type="checkbox"
          id="isCommissioner"
          checked={form.isCommissioner}
          onChange={e => onChange({ ...form, isCommissioner: e.target.checked })}
          className="w-4 h-4 accent-blue-600"
        />
        <label htmlFor="isCommissioner" className="text-[10px] font-black uppercase tracking-widest text-slate-600">Commissioner</label>
      </div>
    </div>
  );
}

function GameFormFields({ form, onChange, teams, weekOptions }: { form: GameForm; onChange: (f: GameForm) => void; teams: TeamRow[]; weekOptions: string[] }) {
  const inputCls = "px-3 py-2 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";
  const labelCls = "text-[9px] font-black uppercase tracking-widest text-slate-500";
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Row 1: Year, Home Team, Home Score */}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Year</label>
        <input type="number" value={form.year} onChange={e => onChange({ ...form, year: e.target.value })} placeholder="2025" className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Home Team *</label>
        <select value={form.homeTeamId} onChange={e => onChange({ ...form, homeTeamId: e.target.value })} className={inputCls}>
          <option value="">Select...</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Home Score</label>
        <input type="number" value={form.hScore} onChange={e => onChange({ ...form, hScore: e.target.value })} placeholder="—" className={inputCls} />
      </div>
      {/* Row 2: Week, Away Team, Away Score */}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Week *</label>
        <select value={form.week} onChange={e => onChange({ ...form, week: e.target.value })} className={inputCls}>
          <option value="">Select...</option>
          {weekOptions.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Away Team *</label>
        <select value={form.awayTeamId} onChange={e => onChange({ ...form, awayTeamId: e.target.value })} className={inputCls}>
          <option value="">Select...</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Away Score</label>
        <input type="number" value={form.vScore} onChange={e => onChange({ ...form, vScore: e.target.value })} placeholder="—" className={inputCls} />
      </div>
    </div>
  );
}

export default MaintenanceClient;
