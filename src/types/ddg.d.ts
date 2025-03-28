declare module 'ddg' {
  interface DDGResult {
    title: string;
    text: string;
    url: string;
  }

  interface DDGOptions {
    max_results?: number;
  }

  function text(query: string, options?: DDGOptions): Promise<DDGResult[]>;
  export = { text };
} 