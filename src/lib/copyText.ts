export type CopyTextDependencies = {
  clipboardWrite?: (text: string) => Promise<void>;
  fallbackCopy: (text: string) => boolean;
};

export async function tryCopyText(text: string, dependencies: CopyTextDependencies): Promise<boolean> {
  if (dependencies.clipboardWrite) {
    try {
      await dependencies.clipboardWrite(text);
      return true;
    } catch {
      // Continue with the synchronous selection fallback.
    }
  }

  try {
    return dependencies.fallbackCopy(text);
  } catch {
    return false;
  }
}
