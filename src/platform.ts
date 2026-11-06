import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface AgyBinaryOptions {
  agyBin?: string;
  homeDir?: string;
  pathValue?: string;
  prefix?: string;
  platform?: NodeJS.Platform;
}

export function isAgyBinaryExecutable(filePath: string, platform: NodeJS.Platform = os.platform()): boolean {
  try {
    if (!fs.statSync(filePath).isFile()) return false;
    if (platform !== 'win32') fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function findAgyBinary(options: AgyBinaryOptions = {}): string {
  const platform = options.platform || os.platform();
  const homeDir = options.homeDir || os.homedir();
  const binName = platform === 'win32' ? 'agy.exe' : 'agy';
  const isExecutable = (filePath: string) => isAgyBinaryExecutable(filePath, platform);

  if (options.agyBin && isExecutable(options.agyBin)) return options.agyBin;

  const pathValue = options.pathValue === undefined ? process.env.PATH || '' : options.pathValue;
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory, binName);
    if (isExecutable(candidate)) return candidate;
  }

  const locations = [
    options.prefix && path.join(options.prefix, 'bin', binName),
    path.join(homeDir, 'AppData', 'Local', 'agy', 'bin', binName),
    path.join(homeDir, 'Library', 'Application Support', 'agy', 'bin', binName),
    path.join(homeDir, '.local', 'share', 'agy', 'bin', binName),
    path.join(homeDir, '.local', 'bin', binName),
  ].filter((location): location is string => Boolean(location));

  const fallback = options.prefix
    ? path.join(options.prefix, 'bin', binName)
    : platform === 'win32'
      ? path.join(homeDir, 'AppData', 'Local', 'agy', 'bin', binName)
      : path.join(homeDir, '.local', 'share', 'agy', 'bin', binName);
  return locations.find(isExecutable) || fallback;
}
