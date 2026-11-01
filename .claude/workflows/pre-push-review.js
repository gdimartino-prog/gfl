export const meta = {
  name: 'pre-push-review',
  description: 'Run the AGENTS.md pre-push review for GFL: fan out secops (always) + finops/perf/supabase-dba/ui-ux (by touched paths) over the diff in parallel, then return a severity-ordered punch list',
  whenToUse: 'Before any git push, after `npm run verify:prepush` passed. Pass args = { diffPath, files } where diffPath is a saved `git diff origin/main...HEAD` and files is the changed-file list.',
  phases: [{ title: 'Review', detail: 'one reviewer per dimension, scoped to the diff' }],
}

// args: { diffPath: string, files: string[] }
const files = Array.isArray(args?.files) ? args.files : []
const diffPath = args?.diffPath
if (!diffPath) throw new Error('pre-push-review needs args.diffPath (a saved `git diff origin/main...HEAD`)')

const touches = (re) => files.some((f) => re.test(f))
// Paths grounded in this repo's layout (see AGENTS.md § Stack).
const apiOrLib = touches(/^(app\/api\/|lib\/|auth\.ts$|middleware\.ts$)/)
const paidSurface = touches(/^(lib\/(gemini|notify|espn-stats|ourlads|players|maintenance)\.ts|app\/api\/(cron|scout|press-box|upload|maintenance|espn-)|app\/api\/players\/)/)
const uiCode = touches(/^(app\/(?!api\/).*\.tsx|components\/|context\/|app\/globals\.css)/)
const dbLayer = touches(/^(schema\.ts|drizzle\/|lib\/db(-helpers)?\.ts|scripts\/(enable-rls|fix-|seed-|migrate-|apply-|reset-|copy-|set-|backup-db|restore-db|dedupe-players))/)
const onlyTestsOrDocs = files.length > 0 && files.every((f) => /^(tests?|docs)\/|\.md$/.test(f))

const FINDINGS = {
  type: 'object',
  properties: {
    attestation: { type: 'string', description: 'For secops: the Semgrep attestation line and the tenant-isolation statement; for supabase-dba: whether db:push / RLS re-enable / write scripts are involved; otherwise a one-line summary' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'suggestion'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          summary: { type: 'string' },
          failure_scenario: { type: 'string' },
          fix: { type: 'string' },
          preexisting: { type: 'boolean' },
        },
        required: ['severity', 'file', 'summary', 'failure_scenario'],
      },
    },
  },
  required: ['attestation', 'findings'],
}

const scope = `Review ONLY the diff saved at ${diffPath} (Read it; do not run git). Changed files: ${files.join(', ') || '(unknown — read the diff)'}. Report findings strictly within the diff; mark anything outside it preexisting=true. Severity scale: critical / high / medium / suggestion.`

const reviewers = []
reviewers.push({ key: 'secops', agentType: 'secops', prompt: `${scope}\n\nRun the full SecOps review per your agent definition (leagueId scoping, isPrivileged(), private cache headers, secrets, input validation, audit fields). Run \`npm run semgrep\` and report the exact finding count in the attestation.` })
if ((apiOrLib || paidSurface) && !onlyTestsOrDocs) reviewers.push({ key: 'finops', agentType: 'finops', prompt: `${scope}\n\nRun the FinOps review per your agent definition.${paidSurface ? ' This diff touches a paid/external surface (Gemini, email/WhatsApp, Blob, ESPN/Ourlads, or cron) — trace the invocation and call counts explicitly.' : ''}` })
if ((uiCode || apiOrLib || dbLayer) && !onlyTestsOrDocs) reviewers.push({ key: 'perf', agentType: 'perf', prompt: `${scope}\n\nRun the performance review per your agent definition.` })
if (dbLayer) reviewers.push({ key: 'supabase-dba', agentType: 'supabase-dba', prompt: `${scope}\n\nReview the schema / RLS / write-script / query changes per your agent definition. Do NOT run any fix-*, seed-*, or migrate-* script.` })
if (uiCode) reviewers.push({ key: 'ui-ux', agentType: 'ui-ux', prompt: `${scope}\n\nReview only materially user-facing changes (new pages, layouts, forms, dialogs, states). Skip if the UI diff is trivial — say so.` })

log(`Reviewers: ${reviewers.map((r) => r.key).join(', ')}${onlyTestsOrDocs ? ' (tests/docs-only diff — finops/perf skipped)' : ''}`)

phase('Review')
const results = await parallel(reviewers.map((r) => () =>
  agent(r.prompt, { label: `review:${r.key}`, phase: 'Review', agentType: r.agentType, schema: FINDINGS })
    .then((res) => ({ reviewer: r.key, ...(res || { attestation: 'reviewer returned nothing', findings: [] }) }))))

const order = { critical: 0, high: 1, medium: 2, suggestion: 3 }
const all = results.filter(Boolean).flatMap((r) => r.findings.map((f) => ({ reviewer: r.reviewer, ...f })))
  .sort((a, b) => order[a.severity] - order[b.severity])
const blocking = all.filter((f) => !f.preexisting && (f.severity === 'critical' || f.severity === 'high') && (f.reviewer === 'secops' || f.reviewer === 'finops' || f.reviewer === 'supabase-dba'))
log(`${all.length} findings, ${blocking.length} blocking (🔴/🟠 SecOps/FinOps/DBA)`)

return {
  attestations: results.filter(Boolean).map((r) => ({ reviewer: r.reviewer, attestation: r.attestation })),
  findings: all,
  blocking,
  verdict: blocking.length ? 'FIX_THEN_RE_REVIEW' : 'ASK_USER_PUSH',
}
