declare module 'lru-cache' {
    export interface Options<K, V> {
        max?: number;
        ttl?: number;
        ttlAutopurge?: boolean;
    }
    export default class LRUCache<K, V> {
        constructor(options: Options<K, V>);
        get(key: K): V | undefined;
        set(key: K, value: V, options?: { ttl?: number }): this;
        delete(key: K): boolean;
        keys(): IterableIterator<K>;
        clear(): void;
        get size(): number;
    }
}
