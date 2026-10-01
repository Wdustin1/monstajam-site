import { execFileSync } from 'node:child_process';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';

export function adminOperatorArguments() {
  const args = process.argv.slice(2);
  const options: { apply: boolean; database?: string; output?: string } = { apply: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--expect-database' || arg === '--output') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('A required command argument is missing.');
      if (arg === '--expect-database') options.database = value;
      else options.output = value;
    } else throw new Error('Unknown command argument.');
  }
  if (!options.database) throw new Error('Specify --expect-database with the exact database name.');
  if (options.apply && (!options.output || !path.isAbsolute(options.output))) throw new Error('Specify an absolute --output path outside the repository.');
  return options;
}

export async function privateAdminOutput(destination: string) {
  const parent = await realpath(path.dirname(destination));
  const repository = await realpath(path.resolve(__dirname, '../..'));
  const relative = path.relative(repository, parent);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('The owner setup file must be outside the repository.');
  }
  const resolved = path.join(parent, path.basename(destination));
  const file = await open(resolved, 'wx', 0o600);
  try {
    if (process.platform === 'win32') {
      // POSIX mode bits do not protect bearer links on Windows.
      const principal = execFileSync('whoami', [], { encoding: 'utf8', windowsHide: true }).trim();
      if (!principal) throw new Error('The current Windows account could not be identified.');
      execFileSync('icacls', [resolved, '/inheritance:r', '/grant:r', `${principal}:(F)`], { stdio: 'ignore', windowsHide: true });
    }
    return file;
  } catch (error) { await file.close(); throw error; }
}
