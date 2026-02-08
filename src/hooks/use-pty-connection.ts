import { useEffect, useRef } from 'react'
import { usePty } from '@/hooks/use-pty'
import { debug } from '@/lib/logger'
import { useTerminalStore } from '@/store/terminal-store'

const MAX_SPAWN_RETRIES = 3

interface UsePtyConnectionOptions {
  write: ((data: string) => void) | null
}

interface UsePtyConnectionReturn {
  isConnected: boolean
  ptyWrite: (data: string) => void
  ptyResize: (cols: number, rows: number) => void
}

export function usePtyConnection({
  write,
}: UsePtyConnectionOptions): UsePtyConnectionReturn {
  const writeRef = useRef<((data: string) => void) | null>(null)
  const pendingOutputRef = useRef<string[]>([])
  const decoderRef = useRef(new TextDecoder('utf-8', { fatal: false }))

  const spawnedRef = useRef(false)
  const spawnRetryRef = useRef(0)

  const {
    isConnected,
    spawn: ptySpawn,
    write: ptyWrite,
    resize: ptyResize,
  } = usePty({
    onData: data => {
      const decoded = decoderRef.current.decode(data, { stream: true })
      debug('[terminal] PTY output', {
        chars: decoded.length,
        writeReady: !!writeRef.current,
      })
      if (writeRef.current) {
        writeRef.current(decoded)
      } else {
        pendingOutputRef.current.push(decoded)
      }
    },
    onExit: () => {
      spawnedRef.current = false
      pendingOutputRef.current = []
      decoderRef.current = new TextDecoder('utf-8', { fatal: false })
    },
  })

  // Sync terminal write function and flush pending output
  useEffect(() => {
    writeRef.current = write
    if (write && pendingOutputRef.current.length > 0) {
      const pending = pendingOutputRef.current.join('')
      pendingOutputRef.current = []
      write(pending)
    }
  }, [write])

  // Auto-spawn PTY when terminal is ready
  const isReady = useTerminalStore(state => state.isReady)
  useEffect(() => {
    if (
      isReady &&
      !spawnedRef.current &&
      spawnRetryRef.current < MAX_SPAWN_RETRIES
    ) {
      spawnedRef.current = true
      const { cols, rows } = useTerminalStore.getState()
      ptySpawn({
        command: null,
        args: [],
        cwd: null,
        env: {},
        cols,
        rows,
      }).catch(() => {
        spawnedRef.current = false
        spawnRetryRef.current++
      })
    }
  }, [isReady, ptySpawn])

  return { isConnected, ptyWrite, ptyResize }
}
