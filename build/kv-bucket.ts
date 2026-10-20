// Library files can live in R2 or, on the free plan with no card, in a Workers KV
// namespace (FILES). The app only stores strings and reads them back as text or
// JSON, so this small adapter stands in for env.BUCKET.
export function kvBucket(kv: KVNamespace): R2Bucket {
  return {
    async get(key: string) {
      const value = await kv.get(key);
      if (value === null) return null;
      return { text: async () => value, json: async () => JSON.parse(value) };
    },
    put: (key: string, value: string) => kv.put(key, value),
  } as unknown as R2Bucket;
}
