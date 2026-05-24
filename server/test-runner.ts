import { spawn } from 'child_process';
import {
  normalizeVitestTargets,
  parseVitestJsonOutput,
  type VitestRunSummary
} from './test-runner-parser';

export * from './test-runner-parser';

export async function runVitestSuite(options: { target?: string } = {}): Promise<VitestRunSummary> {
  const targets = normalizeVitestTargets(options.target);
  const args = ['test', '--', '--reporter=json'];
  if (targets.length > 0) {
    args.push(...targets);
  }

  const testProcess = spawn('npm', args, {
    cwd: process.cwd(),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test' }
  });

  let stdout = '';
  let stderr = '';
  let processError: Error | null = null;

  testProcess.stdout?.on('data', (data: Buffer) => {
    stdout += data.toString();
  });

  testProcess.stderr?.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  testProcess.on('error', (error: Error) => {
    processError = error;
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    testProcess.on('close', (code: number | null) => {
      if (processError) {
        reject(processError);
      } else {
        resolve(code ?? 0);
      }
    });
  });

  return parseVitestJsonOutput(stdout, stderr, exitCode);
}
