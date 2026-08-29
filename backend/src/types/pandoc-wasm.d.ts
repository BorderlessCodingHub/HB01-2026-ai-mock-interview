declare module "pandoc-wasm" {
  export function convert(
    options: { from: string; to: string },
    stdin: string,
    files: Record<string, string>,
  ): Promise<{
    stdout?: string;
    stderr?: string;
    warnings?: unknown;
    files?: unknown;
    mediaFiles?: unknown;
  }>;
}
