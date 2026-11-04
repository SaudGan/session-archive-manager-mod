import { expect, test } from 'claude-code/testing'

const LIST = 'mcp__ccd_session_mgmt__list_sessions'
const EVENTS = 'mcp__ccd_session_mgmt__list_events'
const RENAME = 'mcp__ccd_session_mgmt__set_session_title'
const GROUPS = 'mcp__ccd_sidebar__list_groups'
const CREATE = 'mcp__ccd_sidebar__create_group'
const MOVE = 'mcp__ccd_sidebar__move_sessions'

const PANE = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: 'session-manager',
    surface,
    component: 'Pane',
    requestId: 'session-manager',
    props: { title: 'Session manager', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as any

function world() {
  const sessions = [
    { sessionId: 's1', title: 'Website build', isArchived: false, lastActivityAt: '2026-10-20T00:00:00Z', group: { id: 'g-c', name: 'Client Work' } },
    { sessionId: 's4', title: 'Loose idea', isArchived: false, lastActivityAt: '2026-10-26T00:00:00Z', group: null as any },
    { sessionId: 's5', title: 'Plant help', isArchived: false, lastActivityAt: '2026-10-27T00:00:00Z', group: null as any },
    { sessionId: 'kid', title: 'Child session', isArchived: false, startedBy: 'm', lastActivityAt: '2026-10-28T00:00:00Z', group: null as any },
    { sessionId: 'm', title: 'Master Session', isArchived: false, pinned: true, lastActivityAt: '2026-10-28T00:00:00Z', group: null as any },
  ]
  const groups = [{ id: 'g-c', name: 'Client Work' }]
  const calls: { tool: string; input: any }[] = []
  const prompts: string[] = []
  const store: Record<string, unknown> = {}
  return { sessions, groups, calls, prompts, store }
}

function wire(on: any, w: ReturnType<typeof world>) {
  on('command.register', () => ({ value: { command: 'sessions' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__session-manager__set_session_status' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('store.get', (_: any, e: any) => ({ value: w.store[e.key] }))
  on('store.set', (_: any, e: any) => {
    w.store[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined }
  })
  on('model.complete', (_: any, e: any) => {
    w.prompts.push(String(e.prompt))
    const text = JSON.stringify([
      { id: 's4', title: 'Client: logo ideas', section: 'Client Work' },
      { id: 's5', title: 'Gardenia plant care', section: 'Home & Garden' },
    ])
    return { value: { isAnswered: true, text, usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })
  on('tool.call', (_: any, e: any) => {
    w.calls.push({ tool: e.tool, input: e })
    if (e.tool === LIST) return { result: {}, text: JSON.stringify(w.sessions) }
    if (e.tool === GROUPS) return { result: {}, text: JSON.stringify(w.groups) }
    if (e.tool === EVENTS) return { result: {}, text: 'User: help with ' + e.session_id }
    if (e.tool === CREATE) {
      const g = { id: 'g-' + w.groups.length, name: e.name }
      w.groups.push(g)
      return { result: {}, text: JSON.stringify(g) }
    }
    if (e.tool === RENAME) {
      w.sessions.find(s => s.sessionId === e.session_id)!.title = e.title
      return { result: {}, text: 'Renamed.' }
    }
    if (e.tool === MOVE) {
      const g = w.groups.find(x => x.id === e.group_id)!
      for (const id of e.session_ids) w.sessions.find(s => s.sessionId === id)!.group = g
      return { result: {}, text: 'Moved 1 session(s).' }
    }
    return { result: {}, text: '' }
  })
}

async function settle(ui: any, until: () => Promise<boolean>) {
  for (let i = 0; i < 50 && !(await until()); i++) await new Promise(r => setTimeout(r, 10))
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: Rename & sort suggests, Skip drops one, Apply renames, makes the section and moves`, async ($, on) => {
    const w = world()
    wire(on, w)
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await $.command.run({ command: 'sessions', args: '' } as any)
    const ui = await $.ui.mount(PANE(surface))
    if (surface === 'terminal') await ui.press({ key: 'suggest' })
    else await ui.post({ toggle: '__suggest__' }, { in: 'suggest' })
    const texts = async () => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
    await settle(ui, async () => (await texts()).some((t: string) => t?.startsWith('New name')))
    const shown = await texts()
    expect(shown).toContain('New name: Client: logo ideas')
    expect(shown).toContain('Move to: Home & Garden  (new section)')
    // The pinned Master Session is never read or suggested for.
    expect(w.calls.some(c => c.tool === EVENTS && c.input.session_id === 'm')).toBe(false)
    expect(w.prompts[0]).not.toContain('Master Session')
    expect(w.prompts[0]).not.toContain('Child session')
    const svg = (await ui.findAll({ type: 'Svg' })).find((x: any) => String(x.props.alt) === 'Rename & sort')
    if (surface === 'desktop') expect(String(svg.props.source)).toContain('Rename &amp; sort')

    await ui.press({ key: 'skip-s4' })
    expect(await texts()).not.toContain('New name: Client: logo ideas')

    if (surface === 'terminal') await ui.press({ key: 'apply' })
    else await ui.post({ toggle: '__apply__' }, { in: 'apply' })
    await settle(ui, async () => w.calls.some(c => c.tool === MOVE))
    expect(w.calls.filter(c => c.tool === CREATE).map(c => c.input.name)).toEqual(['Home & Garden'])
    expect(w.calls.filter(c => c.tool === RENAME).map(c => c.input.session_id)).toEqual(['s5'])
    expect(w.sessions.find(s => s.sessionId === 's5')!.group?.name).toBe('Home & Garden')
    expect(w.sessions.find(s => s.sessionId === 's4')!.title).toBe('Loose idea')
    await ui.unmount()
  })
}
