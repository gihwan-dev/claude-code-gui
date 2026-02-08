import { useCallback, useRef } from 'react'

interface UseLineBufferReturn {
  handleData: (data: string) => void
  setWrite: (writeFn: ((data: string) => void) | null) => void
}

export function useLineBuffer(): UseLineBufferReturn {
  const lineBufferRef = useRef('')
  const writeRef = useRef<((data: string) => void) | null>(null)

  const setWrite = useCallback((writeFn: ((data: string) => void) | null) => {
    writeRef.current = writeFn
  }, [])

  const handleData = useCallback((data: string) => {
    const writeFn = writeRef.current
    if (!writeFn) return

    for (const ch of data) {
      if (ch === '\r') {
        writeFn(`\r\n${lineBufferRef.current}\r\n`)
        lineBufferRef.current = ''
      } else if (ch === '\x7f' || ch === '\b') {
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1)
          writeFn('\b \b')
        }
      } else if (ch >= ' ') {
        lineBufferRef.current += ch
        writeFn(ch)
      }
    }
  }, [])

  return { handleData, setWrite }
}
