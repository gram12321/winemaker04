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

          // Parse test results from output - match format like:
          // "Tests  1 failed | 107 passed (108)"
          // or "Tests  107 passed (108)"
          let passed = 0;
          let failed = 0;
          let total = 0;

          // Try to match the summary line format - look for "Tests" line (not "Test Files")
          // Format: "     Tests  X failed | Y passed (Z)"
          const testsSummaryMatch = cleanOutput.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)/i);
          if (testsSummaryMatch) {
            failed = parseInt(testsSummaryMatch[1], 10);
            passed = parseInt(testsSummaryMatch[2], 10);
            total = parseInt(testsSummaryMatch[3], 10);
          } else {
            // Try format without failed: "Tests  Y passed (Z)"
            const testsPassedOnlyMatch = cleanOutput.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/i);
            if (testsPassedOnlyMatch) {
              passed = parseInt(testsPassedOnlyMatch[1], 10);
              total = parseInt(testsPassedOnlyMatch[2], 10);
              failed = total - passed;
            } else {
              // Fallback: try to match individual patterns
              const passedMatch = cleanOutput.match(/(\d+)\s+passed/i);
              const failedMatch = cleanOutput.match(/(\d+)\s+failed/i);
              const totalMatch = cleanOutput.match(/\((\d+)\)/);

              passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
              failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
              total = totalMatch ? parseInt(totalMatch[1], 10) : (passed + failed || 0);
            }
          }

          // Parse individual test file results
          // Pattern 1: ✓ tests/path/file.test.ts (X tests) Xms (passed)
          // Pattern 2: ❯ tests/path/file.test.ts (X tests | Y failed) Xms (failed)
          // Match lines like: 
          //   ✓ tests/wine/fermentationCharacteristics.test.ts (14 tests) 15ms
          //   ❯ tests/user/hireStaffWorkflow.test.ts (6 tests | 1 failed) 23485ms
          const testFilePattern = /(✓|✗|❯)\s+([^\s]+\.test\.ts)\s+\((\d+)\s+tests?(?:\s*\|\s*(\d+)\s+failed)?\)\s+(\d+)ms/g;
          const testFiles: Array<{ file: string; tests: number; duration: number; passed: boolean }> = [];
          let match;
          
          while ((match = testFilePattern.exec(cleanOutput)) !== null) {
            const totalTests = parseInt(match[3], 10);
            const failedTests = match[4] ? parseInt(match[4], 10) : 0;
            // File passes if it has ✓ or if it's ❯ with no failed tests
            const filePassed = match[1] === '✓' || (match[1] === '❯' && failedTests === 0);
            
            testFiles.push({
              file: match[2], // Second capture group is the file path (e.g., "tests/user/researchWorkflow.test.ts")
              tests: totalTests,
              duration: parseInt(match[5], 10),
              passed: filePassed
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
