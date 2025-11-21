import type { Plugin } from 'vite';
import { spawn } from 'child_process';

/**
 * Vite plugin that adds an API endpoint to run tests programmatically
 */
export function testApiPlugin(): Plugin {
  return {
    name: 'test-api',
    configureServer(server) {
      server.middlewares.use('/api/test-run', async (req, res, next) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const projectRoot = process.cwd();
          
          // Run vitest using npm test command
          const testProcess = spawn('npm', ['test'], {
            cwd: projectRoot,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, NODE_ENV: 'test' }
          });

          let stdout = '';
          let stderr = '';

          // Collect stdout
          testProcess.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          // Collect stderr
          testProcess.stderr?.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
          });

          // Wait for process to complete with proper error handling
          let processError: Error | null = null;
          
          testProcess.on('error', (error) => {
            processError = error;
          });

          const exitCode = await new Promise<number | null>((resolve, reject) => {
            testProcess.on('close', (code) => {
              if (processError) {
                reject(processError);
              } else {
                resolve(code);
              }
            });
          });

          // Strip ANSI escape codes for parsing
          const cleanOutput = stdout.replace(/\x1b\[[0-9;]*m/g, '');

          // Parse test results from output
          const passedMatch = cleanOutput.match(/Tests:\s+(\d+)\s+passed|(\d+)\s+passed/i);
          const failedMatch = cleanOutput.match(/Tests:\s+(\d+)\s+failed|(\d+)\s+failed/i);
          const totalMatch = cleanOutput.match(/Tests:\s+(\d+)/i);

          const passed = passedMatch ? parseInt(passedMatch[1] || passedMatch[2] || '0', 10) : 0;
          const failed = failedMatch ? parseInt(failedMatch[1] || failedMatch[2] || '0', 10) : 0;
          const total = totalMatch ? parseInt(totalMatch[1] || '0', 10) : (passed + failed || 0);

          // Parse individual test file results
          // Pattern: ✓ tests/path/file.test.ts (X tests) Xms
          // Match lines like: ✓ tests/wine/fermentationCharacteristics.test.ts (14 tests) 15ms
          const testFilePattern = /(✓|✗)\s+([^\s]+\.test\.ts)\s+\((\d+)\s+tests?\)\s+(\d+)ms/g;
          const testFiles: Array<{ file: string; tests: number; duration: number; passed: boolean }> = [];
          let match;
          
          while ((match = testFilePattern.exec(cleanOutput)) !== null) {
            testFiles.push({
              file: match[2], // Second capture group is the file path
              tests: parseInt(match[3], 10),
              duration: parseInt(match[4], 10),
              passed: match[1] === '✓'
            });
          }

          // Clean output for display (keep original with ANSI codes stripped)
          let displayOutput = cleanOutput;
          if (stderr) {
            // Strip ANSI from stderr too
            const cleanStderr = stderr.replace(/\x1b\[[0-9;]*m/g, '');
            displayOutput += '\n\n--- Errors ---\n' + cleanStderr;
          }

          // Limit output length if too long
          if (displayOutput.length > 50000) {
            displayOutput = displayOutput.slice(-50000) + '\n\n... (output truncated)';
          }

          const finalExitCode = exitCode || 0;
          const status = finalExitCode === 0 && failed === 0 ? 'passed' : 'failed';

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            passed,
            failed,
            total: total || passed + failed,
            status,
            output: displayOutput.trim(),
            exitCode: finalExitCode,
            testFiles: testFiles
          }));
        } catch (error: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Failed to run tests',
            message: error.message,
            passed: 0,
            failed: 0,
            total: 0,
            status: 'failed',
            output: `Error: ${error.message}\n\nMake sure npm test works in terminal.\n\nStack: ${error.stack || 'N/A'}`
          }));
        }
      });
    }
  };
}
