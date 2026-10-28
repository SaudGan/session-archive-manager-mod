export type Status = 'attention' | 'done' | 'new'
export type Row = { id: string; title: string; group: string; isArchived: boolean; status: Status; at: string }

declare module 'claude-code' {
  interface PluginState {
    'session-manager': {
      rows: Shaped<Row[]>
      wanted: Shaped<Record<string, boolean>>
      message: Shaped<string>
      open: Shaped<Record<string, boolean>>
    }
  }
}
