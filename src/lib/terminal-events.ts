export interface PtyOutputEvent {
  sessionId: string
  data: string
}

export interface PtyInputEvent {
  sessionId: string
  data: string
}

export interface PtyResizeEvent {
  sessionId: string
  cols: number
  rows: number
}

export interface PtyStatusEvent {
  sessionId: string
  status: 'started' | 'exited'
  exitCode?: number
}

export const PTY_EVENTS = {
  OUTPUT: 'pty:output',
  INPUT: 'pty:input',
  RESIZE: 'pty:resize',
  STATUS: 'pty:status',
} as const
