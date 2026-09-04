import { describe, expect, it } from 'bun:test'
import { creationDateWindows } from '../src/receipts'

const DAY = 24 * 60 * 60 * 1000

describe('creationDateWindows', () => {
  it('issues a single unbounded request when windowing is disabled', () => {
    expect(creationDateWindows({ windowDays: 0 })).toEqual([{ startDate: undefined, endDate: undefined }])
  })

  it('leaves the first lower bound and the last upper bound open when no range is given', () => {
    const windows = creationDateWindows({ windowDays: 30 })
    expect(windows[0].startDate).toBeUndefined()
    expect(windows[windows.length - 1].endDate).toBeUndefined()
  })

  it('covers the requested range with contiguous, non overlapping windows', () => {
    const from = Date.parse('2024-01-01T00:00:00Z')
    const to = from + 10 * DAY
    const windows = creationDateWindows({ from, to, windowDays: 3 })
    expect(windows[0].startDate).toBe(from)
    expect(windows[windows.length - 1].endDate).toBe(to)
    windows.forEach((window, index) => {
      if (index > 0) expect(window.startDate).toBe(windows[index - 1].endDate! + 1)
    })
  })

  it('clamps the last window to the requested upper bound', () => {
    const from = Date.parse('2024-01-01T00:00:00Z')
    const to = from + DAY
    expect(creationDateWindows({ from, to, windowDays: 30 })).toEqual([{ startDate: from, endDate: to }])
  })

  it('still queries a range that ends before the default anchor', () => {
    const to = Date.parse('2005-01-01T00:00:00Z')
    expect(creationDateWindows({ to, windowDays: 30 })).toEqual([{ startDate: undefined, endDate: to }])
  })
})
