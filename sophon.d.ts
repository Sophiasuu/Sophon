declare const process: {
  argv: string[];
  exitCode?: number;
};

declare module "node:fs/promises" {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
}

declare module "node:crypto" {
  export function createHash(algorithm: string): {
    update: (value: string) => {
      digest: (encoding: "hex") => string;
    };
  };
}

declare module "node:path" {
  const path: {
    join: (...parts: string[]) => string;
    dirname: (value: string) => string;
  };

  export default path;
}

declare module "__ENTITY_DATA_IMPORT__" {
  const entityData: Array<{
    id: string;
    name: string;
    slug: string;
    source: "csv" | "seed";
    seedKeyword?: string;
    metadata?: {
      title?: string;
      description?: string;
      tags?: string[];
    };
  }>;

  export default entityData;
}

declare module "next" {
  export interface Metadata {
    title?: string;
    description?: string;
    alternates?: {
      canonical?: string;
    };
  }
}

declare module "next/link" {
  export default function Link(props: any): any;
}

declare module "next/navigation" {
  export function notFound(): never;
}

declare module "react/jsx-runtime" {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}