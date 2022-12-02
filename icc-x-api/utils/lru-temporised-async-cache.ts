export class LruTemporisedAsyncCache<K, V> {
  private readonly maxCacheSize: number
  private readonly maxLifetimeMs: number

  private readonly nodesMap: Map<K, CacheNode<K, V>> = new Map()
  private firstNode: CacheNode<K, V> | null = null
  private lastNode: CacheNode<K, V> | null = null

  constructor(maxCacheSize: number, maxLifetimeMs: number) {
    this.maxCacheSize = maxCacheSize
    this.maxLifetimeMs = maxLifetimeMs
  }

  get(key: K, retrieve: () => Promise<V>): Promise<V> {
    const retrieved = this.nodesMap.get(key)
    if (retrieved !== undefined) {
      this.markUsed(retrieved)
      if (retrieved.expired(this.maxLifetimeMs)) retrieved.value = this.registerJob(key, retrieve)
      return retrieved.valuePromise()
    } else {
      const newNode = new CacheNode(key, this.lastNode, null, this.registerJob(key, retrieve))
      this.addToTail(key, newNode)
      if (this.maxCacheSize > 1 && this.nodesMap.size > this.maxCacheSize) this.evict(this.firstNode!.key, this.firstNode!)
      return newNode.valuePromise()
    }
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

  expired(maxLifetimeMs: number): boolean {
    return maxLifetimeMs > 0 && 'timestamp' in this.value && Date.now() - this.value.timestamp > maxLifetimeMs
  }

  valuePromise(): Promise<V> {
    return 'timestamp' in this.value ? Promise.resolve(this.value.cached) : this.value
  }
}
