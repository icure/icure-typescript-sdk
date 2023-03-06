import { LruTemporisedAsyncCache } from '../../../icc-x-api/utils/lru-temporised-async-cache'
import { expect } from 'chai'
import { sleep } from '../../../icc-x-api'

describe('Lru temporised async cache ', function () {
  it('should automatically retrieve data if not cached', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(100, () => 0)
    let wasRetrieved = false
    const retrieved = await cache.get('a', async () => {
      wasRetrieved = true
      return { item: 1 }
    })
    expect(wasRetrieved).to.be.true
    expect(retrieved).to.equal(1)
  })

  it('should reuse cached data if not expired', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(100, () => 0)
    const retrieved = await cache.get('a', async () => ({ item: 1 }))
    const reused = await cache.get('a', async () => {
      throw new Error('Should reuse cached value')
    })
    expect(reused).to.equal(retrieved)
  })

  it('should re-retrieve data if the cached item is expired by time, without evicting other items', async function () {
    let lifetimeCheckCalled = 0
    const cache = new LruTemporisedAsyncCache<string, number>(2, (value) => {
      lifetimeCheckCalled += 1
      return value < 10 ? 10 : 50
    })
    expect(await cache.get('b', async () => ({ item: 10 }))).to.equal(10)
    const retrieved = await cache.get('a', async () => ({ item: 1 }))
    expect(retrieved).to.equal(1)
    await sleep(20)
    const reRetrieved = await cache.get('a', async (previousValue) => {
      expect(previousValue).to.equal(1)
      return { item: 2 }
    })
    expect(reRetrieved).to.equal(2)
    expect(lifetimeCheckCalled).to.equal(1)
    expect(
      await cache.get('b', async () => {
        throw new Error('Value should have not been evicted')
      })
    ).to.equal(10)
    expect(lifetimeCheckCalled).to.equal(2)
  })

  it('should re-retrieve data if the cached item is expired according to the additional expiration condition, without evicting other items', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(2, () => 0)
    expect(await cache.get('b', async () => ({ item: 10 }))).to.equal(10)
    const retrieved = await cache.get('a', async () => ({ item: 1 }))
    expect(retrieved).to.equal(1)
    const retrieved2 = await cache.get(
      'a',
      async () => {
        throw new Error('Value should not have been evicted')
      },
      (item) => item < 1
    )
    expect(retrieved2).to.equal(1)
    const retrieved3 = await cache.get(
      'a',
      async (previousValue) => {
        expect(previousValue).to.equal(1)
        return { item: 2 }
      },
      (item) => item < 2
    )
    expect(retrieved3).to.equal(2)
    expect(
      await cache.get('b', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(10)
  })

  it('should ignore additional expiration condition on newly retrieved data', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(3, () => 0)
    expect(
      await cache.get(
        'a',
        async () => ({ item: 1 }),
        () => true
      )
    ).to.equal(1)
    expect(
      await cache.get('a', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(1)
  })

  it('should evict the least recently used item if full, regardless of expiration time of items', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(3, (v) => (v == 4 ? 10 : 0))
    expect(await cache.get('a', async () => ({ item: 1 }))).to.equal(1)
    expect(await cache.get('b', async () => ({ item: 2 }))).to.equal(2)
    expect(await cache.get('c', async () => ({ item: 3 }))).to.equal(3)
    expect(
      await cache.get('d', async (prev) => {
        expect(prev).to.be.undefined
        return { item: 4 }
      })
    ).to.equal(4) // This evicts "a"
    expect(
      await cache.get('b', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(2)
    expect(
      await cache.get('c', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(3)
    expect(
      await cache.get('d', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(4)
    expect(
      await cache.get('a', async (prev) => {
        expect(prev).to.be.undefined // "a" was previously evicted so prev should be undefined
        return { item: 5 }
      })
    ).to.equal(5) // This evicts "b"
    await sleep(20)
    // Cache for "d" is expired, but LRU is "c", so we still evict "c"
    expect(await cache.get('b', async () => ({ item: 6 }))).to.equal(6)
    expect(
      await cache.get('a', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(5)
    expect(
      await cache.get('d', async (previousValue) => {
        expect(previousValue).to.equal(4)
        return { item: 7 }
      })
    ).to.equal(7)
    expect(
      await cache.get('c', async (previousValue) => {
        expect(previousValue).to.be.undefined
        return { item: 8 }
      })
    ).to.equal(8)
  })

  it('should update least recently used item', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(3, () => 0)
    expect(await cache.get('a', async () => ({ item: 1 }))).to.equal(1)
    expect(await cache.get('b', async () => ({ item: 2 }))).to.equal(2)
    expect(await cache.get('c', async () => ({ item: 3 }))).to.equal(3)
    // We retrieve "a" again, so LRU will be "b"
    expect(
      await cache.get('a', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(1)
    // Now we run out of space and evict b
    expect(await cache.get('d', async () => ({ item: 4 }))).to.equal(4)
    expect(
      await cache.get('a', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(1)
    expect(
      await cache.get('c', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(3)
    expect(
      await cache.get('b', async (previousValue) => {
        expect(previousValue).to.be.undefined
        return { item: 5 }
      })
    ).to.equal(5)
  })

  it('should support additional eviction triggers for any eviction reason - time based expiration', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(2, () => 10)
    let didTrigger = false
    expect(
      await cache.get('a', async () => ({
        item: 1,
        onEviction: (isReplacement) => {
          expect(isReplacement).to.be.true
          didTrigger = true
        },
      }))
    ).to.equal(1)
    expect(didTrigger).to.be.false
    await sleep(20)
    expect(didTrigger).to.be.false
    expect(await cache.get('a', async () => ({ item: 2 }))).to.equal(2)
    expect(didTrigger).to.be.true
  })

  it('should support additional eviction triggers for any eviction reason - additional expiration condition', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(2, () => 0)
    let didTrigger = false
    expect(
      await cache.get('a', async () => ({
        item: 1,
        onEviction: (isReplacement) => {
          expect(isReplacement).to.be.true
          didTrigger = true
        },
      }))
    ).to.equal(1)
    expect(didTrigger).to.be.false
    expect(
      await cache.get(
        'a',
        async () => ({ item: 2 }),
        () => true
      )
    ).to.equal(2)
    expect(didTrigger).to.be.true
  })

  it('should support additional eviction triggers for any eviction reason - eviction because out of slots', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(1, () => 0)
    let didTrigger = false
    expect(
      await cache.get('a', async () => ({
        item: 1,
        onEviction: (isReplacement) => {
          expect(isReplacement).to.be.false
          didTrigger = true
        },
      }))
    ).to.equal(1)
    expect(didTrigger).to.be.false
    expect(await cache.get('b', async () => ({ item: 2 }))).to.equal(2)
    expect(didTrigger).to.be.true
  })

  it('should support additional eviction triggers for any eviction reason - eviction due to clear, if requested', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(2, () => 0)
    let didTrigger = false
    expect(
      await cache.get('a', async () => ({
        item: 1,
        onEviction: () => {
          didTrigger = true
        },
      }))
    ).to.equal(1)
    cache.clear(false)
    expect(didTrigger).to.be.false
    expect(
      await cache.get('a', async (previousValue) => {
        expect(previousValue).to.be.undefined
        return {
          item: 2,
          onEviction: (isReplacement) => {
            expect(isReplacement).to.be.false
            didTrigger = true
          },
        }
      })
    ).to.equal(2)
    cache.clear(true)
    expect(didTrigger).to.be.true
  })

  it('should not start parallel retrieval jobs for the same key if the job was not evicted', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(1, () => 0)
    const job1 = cache.get('a', async () => {
      await sleep(20)
      return { item: 1 }
    })
    const job2 = cache.get('a', async () => {
      throw new Error('Should not start another job')
    })
    expect(await job2).to.equal(1)
    expect(await job1).to.equal(1)
  })

  it('should be able to evict uncompleted jobs, but still complete them', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(1, () => 0)
    const job1 = cache.get('a', async () => {
      await sleep(20)
      return { item: 1 }
    })
    expect(await cache.get('b', async () => ({ item: 2 }))).to.equal(2)
    expect(await job1).to.equal(1)
    expect(
      await cache.get('b', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(2)
  })

  it('evicted uncompleted jobs, should not override more recent results for the same key when completed', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(1, () => 0)
    const job1 = cache.get('a', async () => {
      await sleep(20)
      return { item: 1 }
    })
    expect(await cache.get('b', async () => ({ item: 2 }))).to.equal(2)
    expect(
      await cache.get('a', async (prev) => {
        expect(prev).to.be.undefined
        return { item: 3 }
      })
    ).to.equal(3)
    expect(await job1).to.equal(1)
    expect(
      await cache.get('a', async () => {
        throw new Error('Value should not have been evicted')
      })
    ).to.equal(3)
  })

  it('should rethrow exceptions from the retrieval job to anyone waiting on the job, but allow future tasks to reattempt the job', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(1, () => 0)
    const error = new Error('This error is expected')
    const job1 = cache.get('a', async () => {
      await sleep(20)
      throw error
    })
    const job2 = cache.get('a', async () => {
      throw new Error('Should not start another job')
    })
    try {
      await job2
    } catch (e) {
      expect(e).to.equal(error)
    }
    try {
      await job1
    } catch (e) {
      expect(e).to.equal(error)
    }
    expect(await cache.get('a', async () => ({ item: 1 }))).to.equal(1)
  })

  it('should immediately perform the eviction triggers on completion if the data will not cached when the job completes', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(1, () => 0)
    let eviction1Performed = false
    const job1 = cache.get('a', async () => {
      await sleep(20)
      return {
        item: 1,
        onEviction: (isReplacement) => {
          expect(isReplacement).to.be.false
          eviction1Performed = true
        },
      }
    })
    // Lose reference to existing and incomplete job for key 'a'
    expect(await cache.get('b', async () => ({ item: 2 }))).to.equal(2)
    // Can't evict because not yet completed
    expect(eviction1Performed).to.be.false
    // Wait for job completion and eviction
    expect(await job1).to.equal(1)
    expect(eviction1Performed).to.be.true
  })

  it('should not replace newer data if old data completes after replacement by newer data', async function () {
    const cache = new LruTemporisedAsyncCache<string, number>(1, () => 0)
    let eviction1Performed = false
    const job1 = cache.get('a', async () => {
      await sleep(20)
      return {
        item: 1,
        onEviction: (isReplacement) => {
          expect(isReplacement).to.be.true
          eviction1Performed = true
        },
      }
    })
    // Lose reference to existing and incomplete job for key 'a'
    expect(await cache.get('b', async () => ({ item: 2 }))).to.equal(2)
    // Can't evict because not yet completed
    expect(eviction1Performed).to.be.false
    // Start new job for 'a' since we don't know about the existing one
    expect(
      await cache.get('a', async () => ({
        item: 3,
        onEviction: () => {
          throw new Error('This should not be called')
        },
      }))
    ).to.equal(3)
    expect(await job1).to.equal(1)
    expect(eviction1Performed).to.be.true
  })
})
