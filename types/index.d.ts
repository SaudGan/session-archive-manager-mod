export type Status = 'attention' | 'done' | 'new'
export type Row = { id: string; title: string; group: string; isArchived: boolean; status: Status; at: string; rc?: boolean; self?: boolean; remote?: string; pinned?: boolean; nested?: boolean }
export type Idea = { title: string; group: string; isNew: boolean }

declare module 'claude-code' {
  interface PluginState {
    'session-manager': {
      rows: Shaped<Row[]>
      wanted: Shaped<Record<string, boolean>>
      message: Shaped<string>
      hot: Shaped<string>
      open: Shaped<Record<string, boolean>>
      ideas: Shaped<Record<string, Idea>>
    }
  }
}
