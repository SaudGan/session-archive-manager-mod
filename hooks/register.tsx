import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Row, Status } from '../types'

const PANE = 'session-manager'
const LIST = 'mcp__ccd_session_mgmt__list_sessions'
const ARCHIVE = 'mcp__ccd_session_mgmt__archive_session'
const UNARCHIVE = 'mcp__ccd_session_mgmt__unarchive_session'

const MOVE = 'mcp__ccd_sidebar__move_sessions'

const rows = atom({ plugin: 'session-manager', key: 'rows' } as const, [], { shape: 'rows-2' })
const wanted = atom({ plugin: 'session-manager', key: 'wanted' } as const, {}, { shape: 'wanted-1' })
const open = atom({ plugin: 'session-manager', key: 'open' } as const, {}, { shape: 'open-1' })
const hot = atom({ plugin: 'session-manager', key: 'hot' } as const, '', { shape: 'hot-1' })
const message = atom({ plugin: 'session-manager', key: 'message' } as const, '', { shape: 'message-1' })

// Your own sections first, alphabetically, then Remote Control, then This Computer, as in the sidebar.
const rank = (g: string) => (g === 'This Computer' ? 2 : g === 'Remote Control' ? 1 : 0)
const COLOR: Record<Status, string> = { attention: 'error', done: 'success', new: 'inactive' }
const LABEL: Record<Status, string> = { attention: 'Needs you', done: 'Done', new: 'Not reviewed' }

type Raw = { sessionId: string; lastActivityAt?: string; title?: string; isArchived?: boolean; group?: { id?: string; name?: string } | null }

async function statuses($: any): Promise<Record<string, Status>> {
return ((await $.store.get('statuses')) as Record<string, Status> | undefined) ?? {}
}

async function refresh($: any) {
  await update($, message, () => 'Loading sessions…')
  try {
    const ran: any = await $.tool.call({ tool: LIST, include_archived: true, limit: 200 })
    const list: Raw[] = JSON.parse(ran.text ?? '[]')
    // The list leaves out the session the mod runs in; fetch it too so it is never missing.
    let selfId = ''
    try {
      const me: any = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__get_session', session_id: 'self' })
      const one = JSON.parse(me.text ?? 'null')
      if (one?.sessionId) {
        selfId = one.sessionId
        if (!list.some(x => x.sessionId === selfId)) list.unshift(one)
      }
    } catch {}
    const saved = await statuses($)
    const known = ((await $.store.get('groups')) as Record<string, string> | undefined) ?? {}
    const ids = ((await $.store.get('groupIds')) as Record<string, string> | undefined) ?? {}
    for (const one of list) {
      if (one.group?.name) known[one.sessionId] = one.group.name
      if (one.group?.name && one.group.id) ids[one.group.name] = one.group.id
    }
    await $.store.set('groups', known)
    await $.store.set('groupIds', ids)
    const next: Row[] = list.map(s => ({
      id: s.sessionId,
      title: s.title ?? s.sessionId,
      group: s.group?.name ?? known[s.sessionId] ?? 'This Computer',
      isArchived: Boolean(s.isArchived),
      at: s.lastActivityAt ?? '',
      rc: Boolean((s as any).remoteControlActive),
      self: s.sessionId === selfId,
      status: saved[s.sessionId] ?? 'new',
    }))
    // Remote Control sessions that live on claude.ai are not in the app's local list; the agent list has them.
    try {
      const peers: any = await $.tool.call({ tool: 'ListAgents' })
      for (const line of String(peers.text ?? '').split('\n')) {
        const m = line.match(/^\s+(.+?)\s+\[([^\]]+)\]\s+·\s+Remote Control\s+·\s+(\S+)/)
        if (!m) continue
        next.push({ id: 'rc:' + m[2], title: m[1]!, group: 'Remote Control', isArchived: false, at: '', status: saved['rc:' + m[2]] ?? 'new', rc: true, remote: m[3]! })
      }
    } catch {}
    next.sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group) || b.at.localeCompare(a.at))
    await update($, rows, () => next)
    await update($, wanted, () => Object.fromEntries(next.map(r => [r.id, !r.isArchived])))
    await update($, message, () => `${next.length} sessions. Toggle, then press Apply.`)
  } catch (err) {
    await update($, message, () => 'Could not load sessions: ' + String(err))
}
}

async function setStatus($: any, id: string, status: Status) {
  const saved = await statuses($)
  await $.store.set('statuses', { ...saved, [id]: status })
  await update($, rows, list => list.map(r => (r.id === id ? { ...r, status } : r)))
}

async function apply($: any) {
  const list = await read($, rows)
  const want = await read($, wanted)
  const changes = list.filter(r => want[r.id] === r.isArchived && !r.self && !r.remote)
  if (changes.length === 0) {
    await update($, message, () => 'Nothing changed. Flip a toggle first.')
    return
  }
  const problems: string[] = []
  for (const r of changes) {
    await update($, message, () => `Working on: ${r.title}`)
    try {
      const input = r.isArchived
        ? { tool: UNARCHIVE, session_id: r.id }
        : { tool: ARCHIVE, session_id: r.id, reason: 'Changed in the Session manager pane' }
      let ran: any = await $.tool.call(input)
      let text = String(ran.deny ?? ran.text ?? '')
      if (/classifier gave no verdict/i.test(text)) {
        ran = await $.tool.call(input)
        text = String(ran.deny ?? ran.text ?? '')
      }
      if (ran.deny || ran.isError || /not archived|refused|denied|cannot|can't|failed|error/i.test(text)) {
        problems.push(`${r.title}: ${text || 'no reason given'}`)
      } else if (r.isArchived) {
        const ids = ((await $.store.get('groupIds')) as Record<string, string> | undefined) ?? {}
        if (ids[r.group]) {
          try { await $.tool.call({ tool: MOVE, session_ids: [r.id], group_id: ids[r.group] }) } catch {}
        }
      }
    } catch (err) {
      problems.push(`${r.title}: ${String((err as any)?.message ?? err)}`)
    }
  }
  await refresh($)
  if (problems.length) {
    const text = 'Did not go through. ' + problems.join(' | ')
    await update($, message, () => text)
  }
}

// Refresh matches Apply in size. It is a quiet gray outline, and turns orange only under the pointer.
function refreshSvg(hover: boolean): string {
  const fill = hover ? '#D97757' : '#30302e'
  const stroke = hover ? '#D97757' : '#55544f'
  const color = hover ? '#ffffff' : '#c4c2bc'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="32" viewBox="0 0 112 32"><rect x="0.5" y="0.5" width="111" height="31" rx="8" fill="${fill}" stroke="${stroke}"/><text x="56" y="21" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="${color}">Refresh</text></svg>`
}

// The Apply button as the desktop draws it: orange with white text while changes wait,
// a quiet gray outline at zero.
function applySvg(pending: number): string {
  const on = pending > 0
  const fill = on ? '#D97757' : '#30302e'
  const stroke = on ? '#D97757' : '#55544f'
  const color = on ? '#ffffff' : '#9a9893'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="32" viewBox="0 0 112 32"><rect x="0.5" y="0.5" width="111" height="31" rx="8" fill="${fill}" stroke="${stroke}"/><text x="56" y="21" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="${color}">Apply (${pending})</text></svg>`
}

// A Claude-style switch with its label: the knob sits on one side and the word
// "ON" or "OFF" sits on the other, in the same type as the rest of the pane.
function switchSvg(on: boolean): string {
  const track = on ? '#D97757' : '#3a3a37'
  const stroke = on ? '#D97757' : '#5c5b56'
  const knob = on ? '#ffffff' : '#c4c2bc'
  const knobX = on ? 58 : 18
  const label = on ? { x: 26, text: 'ON', color: '#ffffff' } : { x: 46, text: 'OFF', color: '#c4c2bc' }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="28" viewBox="0 0 76 28"><rect x="0.5" y="0.5" width="75" height="27" rx="13.5" fill="${track}" stroke="${stroke}"/><circle cx="${knobX}" cy="14" r="10" fill="${knob}"/><text x="${label.x}" y="18.5" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="${label.color}">${label.text}</text></svg>`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sessions', description: 'Show every session with its status and a show/archive toggle' })
    await $.tool.register({
      name: 'set_session_status',
      description:
        "Set a session's status in the Session manager pane: 'attention' (still needs the user), 'done' (served its purpose) or 'new' (not reviewed).",
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          status: { type: 'string', enum: ['attention', 'done', 'new'] },
        },
        required: ['session_id', 'status'],
      },
    })
    return next(e)
  })

  on('tool.call', { tool: 'mcp__session-manager__set_session_status' }, async ($, e) => {
    const input = e as unknown as { session_id: string; status: Status }
    await setStatus($, input.session_id, input.status)
    return { result: { content: [{ type: 'text', text: `Set ${input.session_id} to ${input.status}.` }] } } as any
  })

  on('command.run', { command: 'sessions' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Session manager' })
    await refresh($)
    return { text: 'Session manager opened.' }
  })

  on('ui.message', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const data = e.data as { toggle?: unknown } | null
    const id = typeof data?.toggle === 'string' ? data.toggle : ''
    const hover = e.data as { hover?: unknown; on?: unknown } | null
    if (typeof hover?.hover === 'string') {
      await update($, hot, () => (hover.on === true ? 'refresh' : ''))
      return {}
    }
    if (id === '__refresh__') {
      void refresh($)
      return {}
    }
    if (id === '__apply__') {
      void apply($)
      return {}
    }
    if (id) await update($, wanted, w => ({ ...w, [id]: !(w[id] ?? true) }))
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    // The pill is a surface module; phones and the editor pane have no Client, so they get a plain button.
    const Client = e.surface === 'terminal' || e.surface === 'desktop' ? $.ui.resolve(e).Client : undefined
    // The desktop draws the switch as a vector picture, like the toggles in Claude's settings.
    const Svg = e.surface === 'desktop' ? ($.ui.resolve(e) as any).Svg : undefined
    const list = await read($, rows)
    const want = await read($, wanted)
    const note = await read($, message)
    const isOpen = await read($, open)
    const hovered = await read($, hot)
    const pending = list.filter(r => want[r.id] === r.isArchived && !r.self && !r.remote).length

    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box flexDirection="row" gap={1}>
          {Client && Svg ? (
            <Box key="apply-box">
              <Svg source={applySvg(pending)} alt={`Apply (${pending})`} width={112} height={32} />
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key="apply" module="./toggle.tsx" width="100%" height="100%" props={{ id: '__apply__', on: pending > 0, ghost: true }} />
              </Box>
            </Box>
          ) : (
            <Button key="apply" variant={pending > 0 ? "primary" : "secondary"} onPress={() => void apply($)}>{`Apply (${pending})`}</Button>
          )}
          {Client && Svg ? (
            <Box key="refresh-box">
              <Svg source={refreshSvg(hovered === 'refresh')} alt="Refresh" width={112} height={32} />
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key="refresh" module="./toggle.tsx" width="100%" height="100%" props={{ id: '__refresh__', on: false, ghost: true }} />
              </Box>
            </Box>
          ) : (
            <Button key="refresh" variant="secondary" onPress={() => void refresh($)}>Refresh</Button>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor size="footnote">{note || 'Press Refresh to load your sessions.'}</Text>
        </Box>
        {list.map((r, i) => {
          const shown = want[r.id] ?? !r.isArchived
          const isFirst = i === 0 || list[i - 1]!.group !== r.group
          const expanded = isOpen[r.group] === true
          const count = list.filter(x => x.group === r.group).length
          return (
            <Box key={r.id} flexDirection="column">
              {isFirst && (
                <Box flexDirection="row" marginTop={1} marginBottom={expanded ? 1 : 0}>
                  <Button key={'g-' + r.group} plain onPress={() => void update($, open, o => ({ ...o, [r.group]: !expanded }))}>
                    {(expanded ? '▾  ' : '▸  ') + r.group + '  (' + count + ')'}
                  </Button>
                </Box>
              )}
              {expanded && (
                <Box
                  key={'row-' + r.id}
                  flexDirection="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={1}
                  paddingX={1}
                  marginBottom={1}
                  borderStyle="round"
                  borderColor="subtle"
                  borderDimColor
                  hover={{ borderColor: 'claude', borderDimColor: false }}
                >
                  <Box flexDirection="column">
                    <Text weight="medium">{r.title}</Text>
                    <Text color={COLOR[r.status]} size="footnote">{LABEL[r.status]}</Text>
                    {(r.rc || r.self) && (
                      <Text color="claude" size="footnote">{[r.self ? 'This session' : '', r.rc ? '● Remote Control' + (r.remote ? ' · ' + r.remote : '') : ''].filter(Boolean).join('  ·  ')}</Text>
                    )}
                  </Box>
                  {r.self ? (
                    <Text dimColor size="footnote">Always on</Text>
                  ) : r.remote ? (
                    <Text dimColor size="footnote">On claude.ai</Text>
                  ) : Client && Svg ? (
                    <Box key={'sw-' + r.id}>
                      <Svg source={switchSvg(shown)} alt={`${r.title}: ${shown ? 'On' : 'Off'}`} width={76} height={28} />
                      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                        <Client key={'t-' + r.id} module="./toggle.tsx" width="100%" height="100%" props={{ id: r.id, on: shown, ghost: true }} />
                      </Box>
                    </Box>
                  ) : Client ? (
                    <Client key={'t-' + r.id} module="./toggle.tsx" props={{ id: r.id, on: shown }} />
                  ) : (
                    <Button key={'t-' + r.id} variant={shown ? 'primary' : 'secondary'} onPress={() => void update($, wanted, w => ({ ...w, [r.id]: !shown }))}>
                      {shown ? 'ON  ●' : '●  OFF'}
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
