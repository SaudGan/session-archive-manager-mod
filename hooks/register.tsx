import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Row, Status } from '../types'

const PANE = 'session-manager'
const LIST = 'mcp__ccd_session_mgmt__list_sessions'
const ARCHIVE = 'mcp__ccd_session_mgmt__archive_session'
const UNARCHIVE = 'mcp__ccd_session_mgmt__unarchive_session'

const rows = atom({ plugin: 'session-manager', key: 'rows' } as const, [], { shape: 'rows-2' })
const wanted = atom({ plugin: 'session-manager', key: 'wanted' } as const, {}, { shape: 'wanted-1' })
const open = atom({ plugin: 'session-manager', key: 'open' } as const, {}, { shape: 'open-1' })
const message = atom({ plugin: 'session-manager', key: 'message' } as const, '', { shape: 'message-1' })

const MOVE = 'mcp__ccd_sidebar__move_sessions'

const rank = (g: string) => (g === 'No section' ? 1 : 0)
const COLOR: Record<Status, string> = { attention: 'red', done: 'green', new: 'gray' }
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
      group: s.group?.name ?? known[s.sessionId] ?? 'No section',
      isArchived: Boolean(s.isArchived),
      at: s.lastActivityAt ?? '',
      status: saved[s.sessionId] ?? 'new',
    }))
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
  const changes = list.filter(r => want[r.id] === r.isArchived)
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

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, rows)
    const want = await read($, wanted)
    const note = await read($, message)
    const isOpen = await read($, open)
    const pending = list.filter(r => want[r.id] === r.isArchived).length

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Button key="apply" variant="primary" onPress={() => void apply($)}>{`Apply (${pending})`}</Button>
          <Button key="refresh" onPress={() => void refresh($)}>Refresh</Button>
        </Box>
        <Text dimColor>{note || 'Press Refresh to load your sessions.'}</Text>
        {list.map((r, i) => {
          const shown = want[r.id] ?? !r.isArchived
          const isFirst = i === 0 || list[i - 1]!.group !== r.group
          const expanded = isOpen[r.group] === true
          return (
            <Box key={r.id} flexDirection="column">
              {isFirst && (
                <Box flexDirection="row" marginTop={1}>
                  <Button key={'g-' + r.group} plain onPress={() => void update($, open, o => ({ ...o, [r.group]: !expanded }))}>
                    {(expanded ? '▾  ' : '▸  ') + r.group + '  (' + list.filter(x => x.group === r.group).length + ')'}
                  </Button>
                </Box>
              )}
              {expanded && (
                <Box flexDirection="row" justifyContent="space-between">
                  <Box flexDirection="column">
                    <Text>{r.title}</Text>
                    <Text color={COLOR[r.status]}>{LABEL[r.status]}</Text>
                  </Box>
                  <Button key={'t-' + r.id} variant={shown ? 'primary' : 'secondary'} onPress={() => void update($, wanted, w => ({ ...w, [r.id]: !shown }))}>
                    {shown ? 'ON  ●' : '●  OFF'}
                  </Button>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
