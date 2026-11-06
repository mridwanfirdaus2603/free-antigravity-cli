import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findAgyBinary } from '../src/platform';

describe('agy binary discovery', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'free-antigravity-platform-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function makeExecutable(filePath: string): string {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(filePath, 0o755);
    return filePath;
  }

  test('uses the AGY_BIN override when it is executable', () => {
    const binary = makeExecutable(path.join(root, 'custom', 'agy'));

    expect(findAgyBinary({ agyBin: binary, homeDir: root, pathValue: '', platform: 'linux' })).toBe(binary);
  });

  test('finds agy on PATH without relying on which', () => {
    const binary = makeExecutable(path.join(root, 'bin', 'agy'));

    expect(findAgyBinary({ homeDir: root, pathValue: path.dirname(binary), platform: 'linux' })).toBe(binary);
  });

  test('finds agy in the Termux PREFIX bin directory', () => {
    const prefix = path.join(root, 'data', 'com.termux', 'files', 'usr');
    const binary = makeExecutable(path.join(prefix, 'bin', 'agy'));

    expect(findAgyBinary({ homeDir: root, pathValue: '', prefix, platform: 'linux' })).toBe(binary);
  });

  test('finds agy in the standard Linux install directory', () => {
    const binary = makeExecutable(path.join(root, '.local', 'share', 'agy', 'bin', 'agy'));

    expect(findAgyBinary({ homeDir: root, pathValue: '', platform: 'linux' })).toBe(binary);
  });

  test('skips non-executable files on Linux', () => {
    if (process.platform === 'win32') return;

    const binary = path.join(root, 'bin', 'agy');
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.writeFileSync(binary, 'not executable');

    const fallback = findAgyBinary({ homeDir: root, pathValue: path.dirname(binary), platform: 'linux' });
    expect(fallback).not.toBe(binary);
  });
});
