export class LruTemporisedAsyncCache<K, V> {
  private readonly maxCacheSize: number
  private readonly lifetimeForValue: (value: V) => number

  private readonly nodesMap: Map<K, CacheNode<K, V>> = new Map()
  private firstNode: CacheNode<K, V> | null = null
  private lastNode: CacheNode<K, V> | null = null

  private sequentialJobId = 0

  /**
   * @param maxCacheSize Maximum size of the cache. Any value <= 0 is considered as no limit.
   * @param lifetimeForValue Get the maximum lifetime for an entry given its value, in milliseconds.
   */
  constructor(maxCacheSize: number, lifetimeForValue: (value: V) => number) {
    this.maxCacheSize = maxCacheSize
    this.lifetimeForValue = lifetimeForValue
  }

  /**
   * Get a value if there is an already cached value or job for the provided key.
   * - If the job is in progress this will return the job promise.
   * - If there is already a cached value returns the value, regardless of whether his lifetime is expired or not.
   * - If there is no job nor cached value this will return undefined.
   * @param key key of the entry
   * @return if there is a cached value or job in progress for the entry returns the item and if its lifetime has expired, otherwise returns
   * undefined.
   */
  getIfCachedJob(key: K): Promise<{ item: V; expired: boolean } | undefined> {
    const retrieved = this.nodesMap.get(key)
    if (retrieved !== undefined) {
      if (retrieved.expired((x) => this.lifetimeForValue(x))) {
        return retrieved.valuePromise().then((x) => ({ item: x, expired: true }))
      } else {
        this.markUsed(retrieved)
        return retrieved.valuePromise().then((x) => ({ item: x, expired: false }))
      }
    }
    return Promise.resolve(undefined)
  }

  /**
   * Gets a cached value or retrieves it and caches it if the value is not available or if it is available but expired. A value will never be expired
   * if it was not yet retrieved, even if the retrieved value would be expired according to the {@link additionalExpirationCondition}
   * @param key key of the entry
   * @param retrieve given the previous value (if available, expired but not yet removed) of the entry retrieves an updated value.
   * @param additionalExpirationCondition an expiration condition for already cached values to consider in addition to time-based expiration. Returns
   * always false by default, meaning the value is not expired if its lifetime didn't already surpass the maximum lifetime.
   * @return the cached value if present and not expired, else the retrieved value.
   */
  get(
    key: K,
    retrieve: (previousValue: V | undefined) => Promise<{ item: V; onEviction?: (isReplacement: boolean) => void }>,
    additionalExpirationCondition: (value: V) => boolean = () => false
  ): Promise<V> {
    const retrieved = this.nodesMap.get(key)
    if (retrieved !== undefined) {
      this.markUsed(retrieved)
      const cachedValue = retrieved.cachedValue
      if (retrieved.expired((x) => this.lifetimeForValue(x)) || (cachedValue !== undefined && additionalExpirationCondition(cachedValue))) {
        const newId = this.nextJobId()
        retrieved.onEviction(true)
        retrieved.jobId = newId
        retrieved.value = this.registerJob(key, newId, () => retrieve(cachedValue))
      }
      return retrieved.valuePromise()
    } else {
      const jobId = this.nextJobId()
      const newNode = new CacheNode(
        key,
        jobId,
        this.lastNode,
        null,
        this.registerJob(key, jobId, () => retrieve(undefined))
      )
      this.addToTail(key, newNode)
      if (this.maxCacheSize > 0 && this.nodesMap.size > this.maxCacheSize) this.evict(this.firstNode!.key, this.firstNode!, true)
      return newNode.valuePromise()
    }
  }

  /**
   * Fully empties this cache.
   * @param doOnEvictionOfCleared if true the onEviction triggers for the retrieved and cached data will be executed, otherwise not. onEviction
   * triggers of data for which the retrieval jobs were not completed will automatically be called when the job completes.
   */
  clear(doOnEvictionOfCleared: boolean = true) {
    this.firstNode = null
    this.lastNode = null
    if (doOnEvictionOfCleared) {
      for (const node of this.nodesMap.values()) {
        node.onEviction(false)
      }
    }
    this.nodesMap.clear()
  }

  private addToTail(key: K | null, node: CacheNode<K, V>) {
    node.previous = this.lastNode
    node.next = null
    if (this.lastNode) this.lastNode.next = node
    this.lastNode = node
    if (this.firstNode === null) this.firstNode = node
    if (key != null) this.nodesMap.set(key, node)
  }

  private evict(key: K | null, node: CacheNode<K, V>, doEvictionTriggers: boolean) {
    if (node.previous) node.previous.next = node.next
    if (node.next) node.next.previous = node.previous
    if (this.firstNode === node) this.firstNode = node.next
    if (this.lastNode === node) this.lastNode = node.previous
    if (key !== null) {
      this.nodesMap.delete(key)
    }
    if (doEvictionTriggers) {
      node.onEviction(false)
    }
  }

  private markUsed(node: CacheNode<K, V>) {
    if (node !== this.lastNode) {
      // No need to modify the nodes map
      this.evict(null, node, false)
      this.addToTail(null, node)
    }
  }

  private registerJob(key: K, jobId: number, retrieve: () => Promise<{ item: V; onEviction?: (isReplacement: boolean) => void }>): Promise<V> {
    // The node may have already been evicted by the time the promise completed if the cached surpassed the maximum size.
    return retrieve()
      .then(({ item: v, onEviction }) => {
        const node = this.nodesMap.get(key)
        if (node && node.jobId == jobId) {
          node.value = { cached: v, timestamp: Date.now(), onEviction: (r) => onEviction?.(r) }
        } else {
          onEviction?.(!!node)
        }
        return v
      })
      .catch((e) => {
        const node = this.nodesMap.get(key)
        if (node && node.jobId == jobId) {
          this.evict(key, node, true)
        }
        throw e
      })
  }

  private nextJobId(): number {
    const res = this.sequentialJobId
    if (this.sequentialJobId < Number.MAX_SAFE_INTEGER) {
      this.sequentialJobId = res + 1
    } else {
      this.sequentialJobId = 0
    }
    return res
  }
}

type Cached<V> = { cached: V; timestamp: number; onEviction: (isReplacement: boolean) => void }

class CacheNode<K, V> {
  readonly key: K
  previous: CacheNode<K, V> | null
  next: CacheNode<K, V> | null
  value: Promise<V> | Cached<V>
  jobId: number

  constructor(key: K, jobId: number, previous: CacheNode<K, V> | null, next: CacheNode<K, V> | null, value: Promise<V>) {
    this.key = key
    this.jobId = jobId
    this.previous = previous
    this.next = next
    this.value = value
  }

  expired(lifetimeForValue: (value: V) => number): boolean {
    if ('timestamp' in this.value) {
      const maxLifetime = lifetimeForValue(this.value.cached)
      return maxLifetime > 0 && Date.now() - this.value.timestamp > maxLifetime
    } else return false
  }

  valuePromise(): Promise<V> {
    return 'timestamp' in this.value ? Promise.resolve(this.value.cached) : this.value
  }

  onEviction(isReplacement: boolean): void {
    if ('timestamp' in this.value) {
      this.value.onEviction(isReplacement)
    }
  }

  get cachedValue(): V | undefined {
    return 'timestamp' in this.value ? this.value.cached : undefined
  }
}
