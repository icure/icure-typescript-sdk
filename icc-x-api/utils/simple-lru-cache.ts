export class SimpleLruCache<K, V> {
  private readonly nodesMap: Map<K, CacheNode<K, V>> = new Map()
  private firstNode: CacheNode<K, V> | null = null
  private lastNode: CacheNode<K, V> | null = null

  get size(): number {
    return this.nodesMap.size
  }

  /**
   * Get a value if is cached. Note: null values are indistinguishable from absent value
   */
  getCached(key: K): V | null {
    const retrieved = this.nodesMap.get(key)
    if (retrieved !== undefined) {
      this.markUsed(retrieved)
      return retrieved.value
    } else {
      return null
    }
  }

  set(key: K, value: V) {
    const retrieved = this.nodesMap.get(key)
    if (retrieved !== undefined) {
      this.markUsed(retrieved)
      retrieved.value = value
    } else {
      const newNode: CacheNode<K, V> = {
        key: key,
        value: value,
        previous: null,
        next: null,
      }
      this.addToTail(key, newNode)
    }
  }

  /**
   * Fully empties this cache.
   */
  clear() {
    this.firstNode = null
    this.lastNode = null
    this.nodesMap.clear()
  }

  evictLeastRecentlyUsed(): V {
    const node = this.lastNode
    if (node == null) throw new Error('Internal error: no node left to evict')
    this.evict(node.key, node)
    return node.value
  }

  private addToTail(updateKey: K | null, node: CacheNode<K, V>) {
    node.previous = this.lastNode
    node.next = null
    if (this.lastNode) this.lastNode.next = node
    this.lastNode = node
    if (this.firstNode === null) this.firstNode = node
    if (updateKey != null) this.nodesMap.set(updateKey, node)
  }

  private evict(updateKey: K | null, node: CacheNode<K, V>) {
    if (node.previous) node.previous.next = node.next
    if (node.next) node.next.previous = node.previous
    if (this.firstNode === node) this.firstNode = node.next
    if (this.lastNode === node) this.lastNode = node.previous
    if (updateKey !== null) {
      this.nodesMap.delete(updateKey)
    }
  }

  private markUsed(node: CacheNode<K, V>) {
    if (node !== this.lastNode) {
      // No need to modify the nodes map
      this.evict(null, node)
      this.addToTail(null, node)
    }
  }
}

type CacheNode<K, V> = {
  readonly key: K
  previous: CacheNode<K, V> | null
  next: CacheNode<K, V> | null
  value: V
}
