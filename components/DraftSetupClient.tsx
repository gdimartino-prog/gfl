'use client';

import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, ChevronLeft, AlertTriangle, CheckCircle2, Loader2, Eye, ArrowLeft, Trash2, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';

type TeamRow = { id: number; name: string; teamshort: string | null };

type OrderEntry = {
  teamId: number;
  name: string;
  teamshort: string;
  altGroup: string; // '' = none
};

const ALT_GROUP_COLORS: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700 border-blue-300',
  B: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  C: 'bg-amber-100 text-amber-700 border-amber-300',
  D: 'bg-purple-100 text-purple-700 border-purple-300',
  E: 'bg-rose-100 text-rose-700 border-rose-300',
};

const GROUP_LETTERS = ['', 'A', 'B', 'C', 'D', 'E'];

export default function DraftSetupClient() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 config
  const [year, setYear] = useState(new Date().getFullYear());
  const [draftType, setDraftType] = useState<'free_agent' | 'rookie'>('free_agent');
  const [rounds, setRounds] = useState(10);
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftStartTime, setDraftStartTime] = useState('');
  const [hoursPerPick, setHoursPerPick] = useState<string>('');

  // Step 2 order
  const [teams, setTeams] = useState<OrderEntry[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Step 3 salaries
  const [salaries, setSalaries] = useState<Record<number, string>>({});

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<{ started: boolean } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<{ inserted: number; transferred: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preview toggle
  const [showPreview, setShowPreview] = useState(false);

  // Pick transfer log
  type TransferRow = { id: number; year: number; round: number; draftType: string; from: string; fromShort: string; to: string; toShort: string; historyShorts: string[]; historyNames: string[]; canUndo: boolean; touch_dt: string };
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transferFilter, setTransferFilter] = useState('');
  const [transferSort, setTransferSort] = useState<{ col: keyof TransferRow; dir: 'asc' | 'desc' }>({ col: 'year', dir: 'asc' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTo, setEditingTo] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [allTeams, setAllTeams] = useState<{ name: string; teamshort: string }[]>([]);

  // Add Transfer form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ year: new Date().getFullYear(), draftType: 'free_agent', round: 1, fromTeam: '', toTeam: '' });
  const [addingSaving, setAddingSaving] = useState(false);

  const loadTransfers = () => {
    setTransfersLoading(true);
    Promise.all([
      fetch('/api/draft-setup').then(r => r.json()),
      fetch('/api/teams').then(r => r.json()),
    ]).then(([rows, teamList]) => {
      setTransfers(rows);
      setAllTeams(Array.isArray(teamList) ? teamList.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)) : []);
    }).finally(() => setTransfersLoading(false));
  };

  useEffect(() => { loadTransfers(); }, []);

const updateTransfer = async (id: number) => {
    if (!editingTo) return;
    setSavingId(id);
    await fetch('/api/draft-setup', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, toTeamshort: editingTo }) });
    setSavingId(null);
    setEditingId(null);
    setEditingTo('');
    loadTransfers();
  };

  const undoTransfer = async (id: number, canUndo: boolean) => {
    const msg = canUndo
      ? 'Revert to the previous owner? The last trade in the chain will be undone.'
      : 'Remove this transfer? The pick will revert to the original owner.';
    if (!confirm(msg)) return;
    setSavingId(id);
    await fetch('/api/draft-setup', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, undo: true }) });
    setSavingId(null);
    loadTransfers();
  };

  const addTransfer = async () => {
    if (!addForm.fromTeam || !addForm.toTeam) return;
    setAddingSaving(true);
    const res = await fetch('/api/draft-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromTeam: addForm.fromTeam, toTeam: addForm.toTeam, year: addForm.year, round: addForm.round, coachName: 'commissioner' }),
    });
    setAddingSaving(false);
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to add transfer');
      return;
    }
    setShowAddForm(false);
    setAddForm({ year: new Date().getFullYear(), draftType: 'free_agent', round: 1, fromTeam: '', toTeam: '' });
    loadTransfers();
  };

  useEffect(() => {
    if (step === 2 && teams.length === 0) {
      setTeamsLoading(true);
      fetch('/api/draft-setup/teams')
        .then(r => r.json())
        .then((rows: TeamRow[]) => {
          setTeams(rows.map(t => ({
            teamId: t.id,
            name: t.name,
            teamshort: t.teamshort || '',
            altGroup: '',
          })));
        })
        .finally(() => setTeamsLoading(false));
    }
  }, [step, teams.length]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = [...teams];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setTeams(next);
  };

  const setAltGroup = (teamId: number, group: string) => {
    setTeams(prev => prev.map(t => t.teamId === teamId ? { ...t, altGroup: group } : t));
  };

  // Generate preview picks from current order
  const previewPicks = useMemo(() => {
    if (!showPreview || teams.length === 0) return [];
    const altGroups: Record<string, OrderEntry[]> = {};
    teams.forEach((t, idx) => {
      if (t.altGroup) {
        if (!altGroups[t.altGroup]) altGroups[t.altGroup] = [];
        altGroups[t.altGroup].push({ ...t, r1Position: idx } as OrderEntry & { r1Position: number });
      }
    });

    const getWeight = (t: OrderEntry, r1Pos: number, round: number): number => {
      if (!t.altGroup) return r1Pos;
      const group = altGroups[t.altGroup];
      const idxInGroup = group.findIndex(e => e.teamId === t.teamId);
      const rotatedIdx = (idxInGroup + (round - 1)) % group.length;
      return teams.findIndex(e => e.teamId === group[rotatedIdx].teamId);
    };

    const picks: { round: number; pick: number; team: string; altGroup: string }[] = [];
    let overall = 1;
    for (let round = 1; round <= rounds; round++) {
      const sorted = teams
        .map((t, idx) => ({ t, idx }))
        .sort((a, b) => getWeight(a.t, a.idx, round) - getWeight(b.t, b.idx, round));
      for (const { t } of sorted) {
        picks.push({ round, pick: overall++, team: t.teamshort || t.name, altGroup: t.altGroup });
      }
    }
    return picks;
  }, [showPreview, teams, rounds]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const order = teams.map((t, idx) => ({
        teamId: t.teamId,
        teamshort: t.teamshort,
        r1Position: idx,
        altGroup: t.altGroup || undefined,
      }));

      const salariesPayload: Record<number, number> = {};
      for (const [k, v] of Object.entries(salaries)) {
        if (v) salariesPayload[Number(k)] = Number(v);
      }

      const today = new Date().toISOString().split('T')[0];
      const startAt = draftStartTime
        ? new Date(`${today}T${draftStartTime}`).toISOString()
        : undefined;

      const res = await fetch('/api/draft-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          draftType,
          rounds,
          order,
          salaries: Object.keys(salariesPayload).length ? salariesPayload : undefined,
          confirmed: conflict ? confirmed : undefined,
          startAt,
          hoursPerPick: hoursPerPick ? Number(hoursPerPick) / 60 : undefined,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setConflict({ started: data.started });
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to generate draft');
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      setResult({ inserted: data.inserted, transferred: data.transferred ?? 0 });
    } catch {
      setError('Network error — please try again');
    }
    setSubmitting(false);
  };

  // Success screen
  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-16 max-w-lg w-full text-center space-y-6">
          <CheckCircle2 size={64} className="text-emerald-500 mx-auto" />
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">Draft Generated</h1>
          <p className="text-slate-500 font-bold">
            <span className="text-emerald-600 text-2xl font-black">{result.inserted}</span> picks created for the{' '}
            <span className="font-black text-slate-900">{year} {draftType === 'free_agent' ? 'Free Agent' : 'Rookie'} Draft</span>
          </p>
          {result.transferred > 0 && <p className="text-blue-600 font-bold">{result.transferred} pick transfers re-applied from trade history.</p>}
          <div className="flex gap-4 justify-center">
            <Link href="/draft" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all">
              Go to Draft Board
            </Link>
            <button onClick={() => { setResult(null); setConflict(null); setConfirmed(false); setStep(1); }}
              className="bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">
              New Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="max-w-5xl mx-auto p-8 flex items-center gap-6">
        <Link href="/maintenance" className="bg-white border-2 border-slate-100 p-3 rounded-2xl hover:bg-slate-50 transition-all">
          <ArrowLeft size={20} className="text-slate-400" />
        </Link>
        <div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Draft <span className="text-blue-600">Setup</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Generate Draft Pick Order</p>
        </div>

        {/* Step indicators */}
        <div className="ml-auto flex items-center gap-3">
          {([1, 2, 3] as const).map(s => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black transition-all
              ${step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {s}
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8 pt-0 space-y-8">

        {/* ── STEP 1: CONFIG ── */}
        {step === 1 && (
          <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-12 space-y-10">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Step 1 — Configure Draft</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Season Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xl font-black outline-none focus:border-blue-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Draft Type</label>
                <div className="flex gap-3">
                  {(['free_agent', 'rookie'] as const).map(type => (
                    <button key={type} onClick={() => setDraftType(type)}
                      className={`flex-1 py-3 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all
                        ${draftType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {type === 'free_agent' ? 'Free Agent' : 'Rookie'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Number of Rounds</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={rounds}
                  onChange={e => setRounds(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xl font-black outline-none focus:border-blue-400"
                />
              </div>
            </div>

            {/* Pick Schedule (optional) */}
            <div className="border-t border-slate-100 pt-8 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pick Schedule <span className="font-normal normal-case text-slate-400 tracking-normal">(optional)</span></p>
                <p className="text-[10px] text-slate-400 mt-0.5">Set a start date/time and cadence so each pick has a fixed scheduled slot.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pick 1 Time</label>
                  <input
                    type="time"
                    value={draftStartTime}
                    onChange={e => setDraftStartTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold outline-none focus:border-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Minutes per Pick</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="e.g. 60"
                    value={hoursPerPick}
                    onChange={e => setHoursPerPick(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xl font-black outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setStep(2)}
                disabled={!year || rounds < 1}
                className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 disabled:opacity-40 transition-all">
                Next: Set Round 1 Order →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: ROUND 1 ORDER ── */}
        {step === 2 && (
          <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-12 space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Step 2 — Round 1 Order</h2>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Drag teams to set pick order · Assign alt groups for same-record teams
                </p>
              </div>
              <button onClick={() => setShowPreview(v => !v)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all
                  ${showPreview ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                <Eye size={13} /> Preview All Rounds
              </button>
            </div>

            {/* Alt group legend */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Alt Groups:</span>
              {GROUP_LETTERS.filter(g => g !== '').map(g => (
                <span key={g} className={`px-3 py-1 rounded-full border text-[10px] font-black ${ALT_GROUP_COLORS[g] || 'bg-slate-100 text-slate-500'}`}>
                  Group {g}
                </span>
              ))}
              <span className="text-[10px] font-bold text-slate-400 ml-2">Teams in the same group rotate each round</span>
            </div>

            {teamsLoading ? (
              <div className="py-20 text-center text-slate-400 font-black uppercase animate-pulse">Loading teams...</div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="order-list">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {teams.map((team, index) => (
                        <Draggable key={team.teamId} draggableId={String(team.teamId)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all
                                ${snapshot.isDragging ? 'border-blue-400 bg-blue-50 shadow-xl' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                            >
                              <div {...provided.dragHandleProps} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                                <GripVertical size={18} />
                              </div>

                              <span className="text-2xl font-black italic text-slate-200 w-8 text-right shrink-0">
                                {index + 1}
                              </span>

                              <div className="flex-1 min-w-0">
                                <span className="font-black text-sm text-slate-800 uppercase">{team.name}</span>
                                <span className="ml-2 text-[10px] font-black text-slate-400 uppercase">{team.teamshort}</span>
                              </div>

                              {/* Alt group selector */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alt:</span>
                                {GROUP_LETTERS.map(g => (
                                  <button
                                    key={g || 'none'}
                                    onClick={() => setAltGroup(team.teamId, g)}
                                    className={`w-7 h-7 rounded-lg text-[10px] font-black border transition-all
                                      ${team.altGroup === g
                                        ? g ? (ALT_GROUP_COLORS[g] || 'bg-slate-200') : 'bg-slate-700 text-white border-slate-700'
                                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                                      }`}
                                  >
                                    {g || '—'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}

            {/* Preview panel */}
            {showPreview && previewPicks.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                  Preview — All {rounds} Rounds ({previewPicks.length} picks)
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-0.5">
                  {previewPicks.map(p => (
                    <div key={p.pick} className="flex items-center gap-3 px-4 py-1.5 rounded-xl hover:bg-slate-50">
                      <span className="text-[10px] font-black text-slate-300 w-8 text-right">{p.pick}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase w-16">Rd {p.round}</span>
                      <span className="text-[11px] font-black text-slate-700 uppercase flex-1">{p.team}</span>
                      {p.altGroup && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${ALT_GROUP_COLORS[p.altGroup] || ''}`}>
                          {p.altGroup}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-slate-700 transition-all">
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={() => setStep(3)}
                disabled={teams.length === 0}
                className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 disabled:opacity-40 transition-all">
                Next: Salaries →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: SALARIES + SUBMIT ── */}
        {step === 3 && (
          <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-12 space-y-10">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Step 3 — Salary per Round</h2>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Optional — leave blank to skip salary rules
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: rounds }, (_, i) => i + 1).map(r => (
                <div key={r} className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Round {r}</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 2500000"
                    value={salaries[r] || ''}
                    onChange={e => setSalaries(prev => ({ ...prev, [r]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold outline-none focus:border-blue-400"
                  />
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-slate-50 rounded-2xl p-6 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Summary</p>
              <div className="grid grid-cols-3 gap-4">
                <div><span className="text-[9px] font-black text-slate-400 uppercase">Year</span><p className="font-black text-slate-900 text-lg">{year}</p></div>
                <div><span className="text-[9px] font-black text-slate-400 uppercase">Type</span><p className="font-black text-slate-900 text-lg">{draftType === 'free_agent' ? 'Free Agent' : 'Rookie'}</p></div>
                <div><span className="text-[9px] font-black text-slate-400 uppercase">Picks</span><p className="font-black text-slate-900 text-lg">{rounds * teams.length}</p></div>
              </div>
            </div>

            {/* Conflict warning */}
            {conflict && (
              <div className={`rounded-2xl border-2 p-6 space-y-4 ${conflict.started ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50'}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={24} className={conflict.started ? 'text-red-500 shrink-0 mt-0.5' : 'text-amber-500 shrink-0 mt-0.5'} />
                  <div className="space-y-1">
                    <p className={`font-black text-sm uppercase tracking-wide ${conflict.started ? 'text-red-700' : 'text-amber-700'}`}>
                      Picks already exist for the {year} {draftType === 'free_agent' ? 'Free Agent' : 'Rookie'} Draft
                    </p>
                    {conflict.started && (
                      <p className="font-black text-sm text-red-700">
                        The draft has already started — picks have been made. Regenerating will permanently delete all picks and selections.
                      </p>
                    )}
                    <p className="text-[11px] font-bold text-slate-600">
                      Proceeding will delete all existing picks and regenerate from the new order.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-600" />
                  <span className="text-[11px] font-black text-slate-700">
                    I understand this will delete all existing picks and cannot be undone
                  </span>
                </label>
              </div>
            )}

            {error && (
              <p className="text-red-600 font-black text-sm">{error}</p>
            )}

            <div className="flex justify-between">
              <button onClick={() => { setStep(2); setConflict(null); setConfirmed(false); }}
                className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-slate-700 transition-all">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (!!conflict && !confirmed)}
                className={`flex items-center gap-2 px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-40
                  ${conflict ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : conflict ? 'Delete & Regenerate' : 'Generate Draft'}
              </button>
            </div>
          </div>
        )}

        {/* PICK TRANSFER LOG */}
        <div id="transfers" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">Pick Transfer Log</h2>
              <button
                onClick={async () => {
                  await fetch('/api/admin/revalidate', { method: 'POST' });
                  alert('Draft board cache refreshed.');
                }}
                className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 border border-slate-200 px-2 py-1 rounded-lg transition-colors"
                title="Force refresh the draft board cache"
              >
                Refresh Cache
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Transfer
              </button>
              <input
                type="text"
                placeholder="Filter by team..."
                value={transferFilter}
                onChange={e => setTransferFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 w-44"
              />
              <button onClick={loadTransfers} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors">Refresh</button>
            </div>
          </div>
          {/* ADD TRANSFER FORM */}
          {showAddForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Add Pick Transfer — current owner → new owner</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Year</label>
                  <input type="number" value={addForm.year} onChange={e => setAddForm(f => ({ ...f, year: Number(e.target.value) }))}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold w-24 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Round</label>
                  <input type="number" min={1} value={addForm.round} onChange={e => setAddForm(f => ({ ...f, round: Number(e.target.value) }))}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold w-20 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Current Owner (From)</label>
                  <select value={addForm.fromTeam} onChange={e => setAddForm(f => ({ ...f, fromTeam: e.target.value }))}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[160px]">
                    <option value="">Select team…</option>
                    {allTeams.map(t => <option key={t.teamshort} value={t.teamshort ?? ''}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">New Owner (To)</label>
                  <select value={addForm.toTeam} onChange={e => setAddForm(f => ({ ...f, toTeam: e.target.value }))}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[160px]">
                    <option value="">Select team…</option>
                    {allTeams.map(t => <option key={t.teamshort} value={t.teamshort ?? ''}>{t.name}</option>)}
                  </select>
                </div>
                <button onClick={addTransfer} disabled={addingSaving || !addForm.fromTeam || !addForm.toTeam}
                  className="px-5 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {addingSaving ? 'Saving…' : 'Add'}
                </button>
                <button onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {transfersLoading ? (
            <p className="text-sm text-slate-400 font-black uppercase animate-pulse">Loading...</p>
          ) : transfers.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No pick transfers on record.</p>
          ) : (() => {
            const search = transferFilter.toLowerCase();
            const filtered = transfers.filter(t =>
              !search || t.from.toLowerCase().includes(search) || t.to.toLowerCase().includes(search)
            );
            const sorted = [...filtered].sort((a, b) => {
              const { col, dir } = transferSort;
              const av = a[col], bv = b[col];
              const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
              return dir === 'asc' ? cmp : -cmp;
            });
            const sortBtn = (col: keyof TransferRow, label: string) => (
              <th
                className="text-left py-2 px-3 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:text-slate-700 select-none whitespace-nowrap"
                onClick={() => setTransferSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }))}
              >
                {label} {transferSort.col === col ? (transferSort.dir === 'asc' ? '↑' : '↓') : ''}
              </th>
            );
            return (
              <div className="overflow-x-auto">
                <p className="text-[10px] text-slate-400 font-bold mb-2">{sorted.length} transfer{sorted.length !== 1 ? 's' : ''}{search ? ` matching "${transferFilter}"` : ''}</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {sortBtn('year', 'Year')}
                      {sortBtn('round', 'Round')}
                      {sortBtn('draftType', 'Type')}
                      {sortBtn('from', 'From')}
                      {sortBtn('to', 'To')}
                      {sortBtn('touch_dt', 'Date')}
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(t => (
                      <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-700">{t.year}</td>
                        <td className="py-2 px-3 font-bold text-slate-700">Rd {t.round}</td>
                        <td className="py-2 px-3 text-slate-500 capitalize">{t.draftType.replace('_', ' ')}</td>
                        <td className="py-2 px-3 text-slate-700">
                          <div className="flex flex-col">
                            <span>{t.from}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                              {[t.fromShort, ...t.historyShorts, t.toShort].join(' → ')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-bold text-blue-600">
                          {editingId === t.id ? (
                            <select
                              value={editingTo}
                              onChange={e => setEditingTo(e.target.value)}
                              className="border border-blue-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              autoFocus
                            >
                              <option value="">-- Select team --</option>
                              {allTeams.map(tm => (
                                <option key={tm.teamshort} value={tm.teamshort}>{tm.name}</option>
                              ))}
                            </select>
                          ) : t.to}
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-xs">{new Date(t.touch_dt).toLocaleDateString()}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            {editingId === t.id ? (
                              <>
                                <button
                                  onClick={() => updateTransfer(t.id)}
                                  disabled={!editingTo || savingId === t.id}
                                  className="text-emerald-500 hover:text-emerald-700 disabled:opacity-40 transition-colors"
                                  title="Save"
                                >
                                  {savingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                </button>
                                <button
                                  onClick={() => { setEditingId(null); setEditingTo(''); }}
                                  className="text-slate-400 hover:text-slate-600 transition-colors"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => undoTransfer(t.id, t.canUndo)}
                                  disabled={savingId === t.id}
                                  className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                                  title={t.canUndo ? 'Revert to previous owner' : 'Remove transfer (revert to original owner)'}
                                >
                                  {savingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                                <button
                                  onClick={() => { setEditingId(t.id); setEditingTo(''); }}
                                  className="text-slate-300 hover:text-blue-500 transition-colors"
                                  title="Edit current owner"
                                >
                                  <Pencil size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
