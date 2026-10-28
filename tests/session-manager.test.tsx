import { expect, test } from 'claude-code/testing'

const LIST = 'mcp__ccd_session_mgmt__list_sessions'
const ARCHIVE = 'mcp__ccd_session_mgmt__archive_session'
const UNARCHIVE = 'mcp__ccd_session_mgmt__unarchive_session'
const MOVE = 'mcp__ccd_sidebar__move_sessions'
const STATUS = 'mcp__session-manager__set_session_status'

const PANE = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: 'session-manager',
    surface,
    component: 'Pane',
    requestId: 'session-manager',
    props: {
      title: 'Session manager',
      isFocused: false,
      bodyColumns: 60,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  }) as any

type S = { sessionId: string; title: string; isArchived: boolean; lastActivityAt: string; group: { id: string; name: string } | null }

function world(opts: { archiveText?: string[]; dropGroupWhenArchived?: boolean } = {}) {
  const sessions: S[] = [
    { sessionId: 's1', title: 'Website build', isArchived: false, lastActivityAt: '2026-10-20T00:00:00Z', group: { id: 'g-c', name: 'Client Work' } },
    { sessionId: 's2', title: 'Brand colors', isArchived: false, lastActivityAt: '2026-10-25T00:00:00Z', group: { id: 'g-c', name: 'Client Work' } },
    { sessionId: 's3', title: 'Old teardown', isArchived: true, lastActivityAt: '2026-10-10T00:00:00Z', group: { id: 'g-r', name: 'Research' } },
    { sessionId: 's4', title: 'Loose idea', isArchived: false, lastActivityAt: '2026-10-26T00:00:00Z', group: null },
  ]
  const calls: { tool: string; input: any }[] = []
  const store: Record<string, unknown> = {}
  const archiveText = [...(opts.archiveText ?? [])]
  return { sessions, calls, store, archiveText, opts }
}

function wire(on: any, w: ReturnType<typeof world>) {
  on('command.register', () => ({ value: { command: 'sessions' } }))
  on('tool.register', () => ({ value: { tool: STATUS } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('store.get', (_: any, e: any) => ({ value: w.store[e.key] }))
  on('store.set', (_: any, e: any) => {
    w.store[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined }
  })
  on('tool.call', (_: any, e: any) => {
    w.calls.push({ tool: e.tool, input: e })
    if (e.tool === LIST) {
      const out = w.sessions.map(s => ({ ...s, group: w.opts.dropGroupWhenArchived && s.isArchived ? null : s.group }))
      return { result: {}, text: JSON.stringify(out) }
    }
    if (e.tool === ARCHIVE || e.tool === UNARCHIVE) {
      const scripted = e.tool === ARCHIVE ? w.archiveText.shift() : undefined
      if (scripted !== undefined) return { result: {}, text: scripted }
      const s = w.sessions.find(x => x.sessionId === e.session_id)!
      s.isArchived = e.tool === ARCHIVE
      return { result: {}, text: (e.tool === ARCHIVE ? 'Archived session ' : 'Unarchived session ') + e.session_id }
    }
    if (e.tool === MOVE) return { result: {}, text: 'Moved 1 session(s).' }
    return { result: {}, text: '' }
  })
}

const TITLES: Record<string, string> = { s1: 'Website build', s2: 'Brand colors', s3: 'Old teardown', s4: 'Loose idea' }

// The terminal draws the switch from text; the desktop draws it as a picture whose alt says its state.
async function pill(ui: any, id: string, surface: string) {
  if (surface === 'terminal') return (await ui.findAll({ type: 'Text', in: 't-' + id })).map((t: any) => t.text).join('')
  const pic = (await ui.findAll({ type: 'Svg' })).find((x: any) => String(x.props.alt).startsWith(TITLES[id] + ':'))
  return pic ? (String(pic.props.alt).endsWith(': On') ? 'ON  ●' : '●  OFF') : ''
}

async function applyLabel(ui: any, surface: string) {
  if (surface === 'terminal') return (await ui.find({ key: 'apply' }))?.text
  return (await ui.findAll({ type: 'Svg' })).map((x: any) => String(x.props.alt)).find((a: string) => a.startsWith('Apply'))
}

async function pressApply(ui: any, surface: string) {
  if (surface === 'terminal') await ui.press({ key: 'apply' })
  else await ui.post({ toggle: '__apply__' }, { in: 'apply' })
}

async function flip(ui: any, id: string) {
  await ui.post({ toggle: id }, { in: 't-' + id })
}

async function openPane($: any, surface: 'terminal' | 'desktop') {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'sessions', args: '' } as any)
  const ui = await $.ui.mount(PANE(surface))
  return { ran, ui }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: /sessions opens the pane and lists sections, collapsed`, async ($, on) => {
    const w = world()
    wire(on, w)
    const { ran, ui } = await openPane($, surface)
    expect((ran as any)?.text).toBe('Session manager opened.')
    expect(w.calls.some(c => c.tool === LIST && c.input.include_archived === true)).toBe(true)
    expect((await ui.find({ key: 'g-Client Work' }))?.text).toMatch(/Client Work {2}\(2\)/)
    expect((await ui.find({ key: 'g-Research' }))?.text).toMatch(/Research {2}\(1\)/)
    expect((await ui.find({ key: 'g-This Computer' }))?.text).toMatch(/This Computer {2}\(1\)/)
    expect(await ui.find({ key: 't-s1' })).toBeUndefined()
    const headers = (await ui.findAll({ type: 'Button' })).map((b: any) => b.text).filter((t: any) => /\(\d+\)/.test(t ?? ''))
    expect(headers[headers.length - 1]).toMatch(/This Computer/)
    await ui.unmount()
  })

  test(`${surface}: opening a section shows titles, status and ON/OFF toggles, newest first`, async ($, on) => {
    const w = world()
    wire(on, w)
    const { ui } = await openPane($, surface)
    await ui.press({ key: 'g-Client Work' })
    await ui.press({ key: 'g-Research' })
    expect(await pill(ui, 's1', surface)).toBe('ON  ●')
    expect(await pill(ui, 's3', surface)).toBe('●  OFF')
    const titles = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
    expect(titles.indexOf('Brand colors')).toBeLessThan(titles.indexOf('Website build'))
    expect(titles).toContain('Not reviewed')
    await ui.unmount()
  })

  test(`${surface}: Claude sets a status and the pane shows it`, async ($, on) => {
    const w = world()
    wire(on, w)
    const { ui } = await openPane($, surface)
    await $.tool.call({ tool: STATUS, session_id: 's1', status: 'done' } as any)
    await $.tool.call({ tool: STATUS, session_id: 's2', status: 'attention' } as any)
    await ui.press({ key: 'g-Client Work' })
    const texts = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text)
    expect(texts).toContain('Done')
    expect(texts).toContain('Needs you')
    expect((w.store.statuses as any).s1).toBe('done')
    await ui.unmount()
  })

  test(`${surface}: Apply archives a session turned OFF and restores one turned ON into its section`, async ($, on) => {
    const w = world()
    wire(on, w)
    const { ui } = await openPane($, surface)
    await ui.press({ key: 'g-Client Work' })
    await ui.press({ key: 'g-Research' })
    await ui.pointer({ type: 'up', x: 2, y: 0, button: 'left', in: 't-s1' })
    await flip(ui, 's3')
    expect((await applyLabel(ui, surface))).toBe('Apply (2)')
    await pressApply(ui, surface)
    const archive = w.calls.find(c => c.tool === ARCHIVE)
    const unarchive = w.calls.find(c => c.tool === UNARCHIVE)
    const move = w.calls.find(c => c.tool === MOVE)
    expect(archive?.input.session_id).toBe('s1')
    expect(unarchive?.input.session_id).toBe('s3')
    expect(unarchive?.input.reason).toBeUndefined()
    expect(move?.input.session_ids).toEqual(['s3'])
    expect(move?.input.group_id).toBe('g-r')
    expect(w.calls.some(c => c.tool === 'mcp__ccd_session_mgmt__delete_session')).toBe(false)
    expect(await pill(ui, 's1', surface)).toBe('●  OFF')
    expect(await pill(ui, 's3', surface)).toBe('ON  ●')
    expect((await applyLabel(ui, surface))).toBe('Apply (0)')
    await ui.unmount()
  })

  test(`${surface}: an archived session keeps its section even when the app forgets it`, async ($, on) => {
    const w = world({ dropGroupWhenArchived: true })
    w.sessions[2]!.isArchived = false
    wire(on, w)
    const { ui } = await openPane($, surface)
    await ui.press({ key: 'g-Research' })
    await flip(ui, 's3')
    await pressApply(ui, surface)
    expect((await ui.find({ key: 'g-Research' }))?.text).toMatch(/\(1\)/)
    expect(await pill(ui, 's3', surface)).toBe('●  OFF')
    expect(await ui.find({ key: 'g-This Computer' })).toBeDefined()
    expect((await ui.find({ key: 'g-This Computer' }))?.text).toMatch(/\(1\)/)
    await ui.unmount()
  })

  test(`${surface}: a refused change is reported, and the classifier hiccup is retried`, async ($, on) => {
    const w = world({ archiveText: ['The server-side auto mode classifier gave no verdict for this.', 'Session s2 is still working and was not archived.'] })
    wire(on, w)
    const { ui } = await openPane($, surface)
    await ui.press({ key: 'g-Client Work' })
    await flip(ui, 's1')
    await flip(ui, 's2')
    await pressApply(ui, surface)
    // Newest first: s2 is tried first, hits the classifier hiccup, is retried once, then is refused.
    expect(w.calls.filter(c => c.tool === ARCHIVE && c.input.session_id === 's2')).toHaveLength(2)
    expect(w.calls.filter(c => c.tool === ARCHIVE && c.input.session_id === 's1')).toHaveLength(1)
    const note = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).find((t: any) => /Did not go through/.test(t ?? ''))
    expect(note).toMatch(/Brand colors/)
    expect(note).not.toMatch(/Website build/)
    await ui.unmount()
  })

  test(`${surface}: Apply with nothing flipped says so and calls nothing`, async ($, on) => {
    const w = world()
    wire(on, w)
    const { ui } = await openPane($, surface)
    await pressApply(ui, surface)
    expect(w.calls.some(c => c.tool === ARCHIVE || c.tool === UNARCHIVE)).toBe(false)
    expect((await ui.find({ type: 'Text', text: /Nothing changed/ }))?.text).toMatch(/Flip a toggle first/)
    await ui.unmount()
  })
}
