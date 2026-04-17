import { describe, it } from 'mocha'
import { expect } from 'chai'
import { Mutex } from '../../../icc-x-api/utils/mutex'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Mutex', () => {
  it('should allow a single holder to acquire and release', async () => {
    const mutex = new Mutex()
    const release = await mutex.acquire()
    release()
  })

  it('should serialize concurrent access to a critical section', async () => {
    const mutex = new Mutex()
    const log: string[] = []

    async function worker(id: string, workMs: number) {
      const release = await mutex.acquire()
      try {
        log.push(`${id}:enter`)
        await delay(workMs)
        log.push(`${id}:exit`)
      } finally {
        release()
      }
    }

    await Promise.all([worker('a', 30), worker('b', 10), worker('c', 10)])

    expect(log).to.deep.equal(['a:enter', 'a:exit', 'b:enter', 'b:exit', 'c:enter', 'c:exit'])
  })

  it('should protect shared state from concurrent mutation', async () => {
    const mutex = new Mutex()
    let counter = 0

    async function increment() {
      const release = await mutex.acquire()
      try {
        const current = counter
        await delay(5)
        counter = current + 1
      } finally {
        release()
      }
    }

    await Promise.all(Array.from({ length: 10 }, () => increment()))

    expect(counter).to.equal(10)
  })

  it('should release correctly even when the critical section throws', async () => {
    const mutex = new Mutex()
    const log: string[] = []

    async function failing() {
      const release = await mutex.acquire()
      try {
        log.push('fail:enter')
        throw new Error('boom')
      } finally {
        release()
      }
    }

    async function succeeding() {
      const release = await mutex.acquire()
      try {
        log.push('ok:enter')
      } finally {
        release()
      }
    }

    await failing().catch(() => {})
    await succeeding()

    expect(log).to.deep.equal(['fail:enter', 'ok:enter'])
  })

  it('should process waiters in FIFO order', async () => {
    const mutex = new Mutex()
    const order: number[] = []

    const release = await mutex.acquire()

    const waiters = Array.from({ length: 5 }, (_, i) =>
      mutex.acquire().then((r) => {
        order.push(i)
        r()
      })
    )

    release()
    await Promise.all(waiters)

    expect(order).to.deep.equal([0, 1, 2, 3, 4])
  })

  it('should allow reuse after full drain', async () => {
    const mutex = new Mutex()

    const r1 = await mutex.acquire()
    r1()

    const r2 = await mutex.acquire()
    r2()

    const r3 = await mutex.acquire()
    r3()
  })
})
