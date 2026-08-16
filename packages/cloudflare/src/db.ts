/** Minimal D1 surface shared by repositories. */
export type D1Queryable = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown>;
};

export type R2HttpMetadata = {
  contentType?: string;
};

export type R2ObjectLike = {
  body: ReadableStream | ArrayBuffer | null;
  size: number;
  httpMetadata?: R2HttpMetadata;
};

export type R2BucketLike = {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string | ReadableStream,
    options?: { httpMetadata?: R2HttpMetadata },
  ): Promise<unknown>;
  get?(key: string): Promise<R2ObjectLike | null>;
};

/** @deprecated Use R2BucketLike */
export type R2Puttable = Pick<R2BucketLike, 'put'>;
