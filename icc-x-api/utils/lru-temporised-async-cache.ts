export class LruTemporisedAsyncCache<K, V> {
  private readonly maxCacheSize: number
  private readonly lifetimeForValue: (value: V) => number

  private readonly nodesMap: Map<K, CacheNode<K, V>> = new Map()
  private firstNode: CacheNode<K, V> | null = null
  private lastNode: CacheNode<K, V> | null = null

  /**
   * @param maxCacheSize Maximum size of the cache. Any value <= 0 is considered as no limit.
   * @param lifetimeForValue Get the maximum lifetime for an entry given its value.
   */
  constructor(maxCacheSize: number, lifetimeForValue: (value: V) => number) {
    this.maxCacheSize = maxCacheSize
    this.lifetimeForValue = lifetimeForValue
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
    retrieve: (previousValue: V | undefined) => Promise<V>,
    additionalExpirationCondition: (value: V) => boolean = () => false
  ): Promise<V> {
    const retrieved = this.nodesMap.get(key)
    if (retrieved !== undefined) {
      this.markUsed(retrieved)
      const cachedValue = retrieved.cachedValue
      if (retrieved.expired((x) => this.lifetimeForValue(x)) || (cachedValue !== undefined && additionalExpirationCondition(cachedValue))) {
        retrieved.value = this.registerJob(key, () => retrieve(cachedValue))
      }
      return retrieved.valuePromise()
    } else {
      const newNode = new CacheNode(
        key,
        this.lastNode,
        null,
        this.registerJob(key, () => retrieve(undefined))
      )
      this.addToTail(key, newNode)
      if (this.maxCacheSize > 0 && this.nodesMap.size > this.maxCacheSize) this.evict(this.firstNode!.key, this.firstNode!)
      return newNode.valuePromise()
    }
  }

  clear() {
    this.firstNode = null
    this.lastNode = null
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

  private evict(key: K | null, node: CacheNode<K, V>) {
    if (node.previous) node.previous.next = node.next
    if (node.next) node.next.previous = node.previous
    if (this.firstNode === node) this.firstNode = node.next
    if (this.lastNode === node) this.lastNode = node.previous
    if (key !== null) this.nodesMap.delete(key)
  }

  private markUsed(node: CacheNode<K, V>) {
    if (node !== this.lastNode) {
      // No need to modify the nodes map
      this.evict(null, node)
      this.addToTail(null, node)
    }
  }

  private registerJob(key: K, retrieve: () => Promise<V>): Promise<V> {
    // The node may have already been evicted by the time the promise completed if the cached surpassed the maximum size.
    return retrieve()
      .then((v) => {
        const node = this.nodesMap.get(key)
        if (node) {
          node.value = { cached: v, timestamp: Date.now() }
        }
        return v
      })
      .catch((e) => {
        const node = this.nodesMap.get(key)
        if (node) {
          this.evict(key, node)
        }
        throw e
      })
  }
}

type Cached<V> = { cached: V; timestamp: number }

class CacheNode<K, V> {
  readonly key: K
  previous: CacheNode<K, V> | null
  next: CacheNode<K, V> | null
  value: Promise<V> | Cached<V>

  constructor(key: K, previous: CacheNode<K, V> | null, next: CacheNode<K, V> | null, value: Promise<V>) {
    this.key = key
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

  get cachedValue(): V | undefined {
    return 'timestamp' in this.value ? this.value.cached : undefined
  }
}
