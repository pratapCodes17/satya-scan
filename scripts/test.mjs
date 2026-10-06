import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('work/test-runtime', { recursive: true });
const compile = spawnSync('npx', [
  'tsc', '--outDir', 'work/test-runtime', '--module', 'commonjs', '--target', 'es2022',
  '--esModuleInterop', '--skipLibCheck', '--resolveJsonModule',
  'tests/inspection.test.ts', 'tests/capture.test.ts', 'lib/inspection.ts', 'lib/validation.ts',
  'lib/report.ts', 'lib/image.ts', 'lib/camera.ts',
], { stdio: 'inherit', shell: process.platform === 'win32' });
if (compile.status !== 0) process.exit(compile.status ?? 1);
const result = spawnSync(process.execPath, ['--test', 'work/test-runtime/tests/inspection.test.js', 'work/test-runtime/tests/capture.test.js'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
