interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Caché en memoria con TTL y tope de entradas. La inserción es
 * FIFO por Map: al superar `maxSize` se descarta la entrada más vieja.
 * Pensada para llamadas salientes a servicios externos (ADR-005).
 */
export class TtlCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();

  constructor(
    private readonly maxSize = 500,
    private readonly ttlMs = 6 * 60 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;

      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
