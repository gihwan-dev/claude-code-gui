import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLineBuffer } from './use-line-buffer'

describe('useLineBuffer', () => {
  let writeFn: ReturnType<typeof vi.fn<(data: string) => void>>

  beforeEach(() => {
    writeFn = vi.fn<(data: string) => void>()
  })

  it('should echo printable characters back to terminal', () => {
    const { result } = renderHook(() => useLineBuffer())

    act(() => {
      result.current.setWrite(writeFn)
    })

    act(() => {
      result.current.handleData('a')
    })

    expect(writeFn).toHaveBeenCalledWith('a')
  })

  it('should buffer characters and flush on Enter', () => {
    const { result } = renderHook(() => useLineBuffer())

    act(() => {
      result.current.setWrite(writeFn)
    })

    act(() => {
      result.current.handleData('h')
      result.current.handleData('i')
      result.current.handleData('\r')
    })

    // 'h', 'i' echoed, then Enter flushes "hi" with newlines
    expect(writeFn).toHaveBeenCalledWith('h')
    expect(writeFn).toHaveBeenCalledWith('i')
    expect(writeFn).toHaveBeenCalledWith('\r\nhi\r\n')
  })

  it('should handle backspace (DEL 0x7f)', () => {
    const { result } = renderHook(() => useLineBuffer())

    act(() => {
      result.current.setWrite(writeFn)
    })

    act(() => {
      result.current.handleData('a')
      result.current.handleData('b')
      result.current.handleData('\x7f')
    })

    expect(writeFn).toHaveBeenCalledWith('a')
    expect(writeFn).toHaveBeenCalledWith('b')
    expect(writeFn).toHaveBeenCalledWith('\b \b')
  })

  it('should handle backspace (BS 0x08)', () => {
    const { result } = renderHook(() => useLineBuffer())

    act(() => {
      result.current.setWrite(writeFn)
    })

    act(() => {
      result.current.handleData('x')
      result.current.handleData('\b')
    })

    expect(writeFn).toHaveBeenCalledWith('x')
    expect(writeFn).toHaveBeenCalledWith('\b \b')
  })

  it('should ignore backspace on empty buffer', () => {
    const { result } = renderHook(() => useLineBuffer())

    act(() => {
      result.current.setWrite(writeFn)
    })

    act(() => {
      result.current.handleData('\x7f')
    })

    expect(writeFn).not.toHaveBeenCalled()
  })

  it('should ignore control characters below space', () => {
    const { result } = renderHook(() => useLineBuffer())

    act(() => {
      result.current.setWrite(writeFn)
    })

    act(() => {
      // Tab, Escape, etc. should be ignored (except \r and \b/\x7f)
      result.current.handleData('\t')
      result.current.handleData('\x1b')
    })

    expect(writeFn).not.toHaveBeenCalled()
  })

  it('should handle multi-character data string', () => {
    const { result } = renderHook(() => useLineBuffer())

    act(() => {
      result.current.setWrite(writeFn)
    })

    act(() => {
      result.current.handleData('abc\r')
    })

    expect(writeFn).toHaveBeenCalledWith('a')
    expect(writeFn).toHaveBeenCalledWith('b')
    expect(writeFn).toHaveBeenCalledWith('c')
    expect(writeFn).toHaveBeenCalledWith('\r\nabc\r\n')
  })

  it('should not write if writeFn is not set', () => {
    const { result } = renderHook(() => useLineBuffer())

    // Don't call setWrite — writeFn stays null
    act(() => {
      result.current.handleData('a')
    })

    // No crash, no calls
    expect(writeFn).not.toHaveBeenCalled()
  })

  it('should clear buffer after Enter and start fresh', () => {
    const { result } = renderHook(() => useLineBuffer())

    act(() => {
      result.current.setWrite(writeFn)
    })

    act(() => {
      result.current.handleData('x\r')
    })

    writeFn.mockClear()

    act(() => {
      result.current.handleData('y\r')
    })

    expect(writeFn).toHaveBeenCalledWith('y')
    expect(writeFn).toHaveBeenCalledWith('\r\ny\r\n')
  })
})
