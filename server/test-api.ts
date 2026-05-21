import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin } from 'vite';
import { isLoopbackRequest } from './devAdminGate';
import { runVitestSuite } from './test-runner';

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown): void => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};

  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (!body) return {};

  return JSON.parse(body) as Record<string, unknown>;
};

/**
 * Vite plugin that exposes development-only test endpoints.
 */
export function testApiPlugin(): Plugin {
  return {
    name: 'test-api',
    configureServer(server) {
      server.middlewares.use('/api/test-run', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        if (!isLoopbackRequest(req)) {
          sendJson(res, 403, { error: 'Admin test endpoints are only available on localhost or loopback hosts' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const target = typeof body.target === 'string' ? body.target : undefined;
          const result = await runVitestSuite({ target });

          sendJson(res, 200, result);
        } catch (error: any) {
          sendJson(res, 500, {
            error: 'Failed to run tests',
            message: error.message,
            passed: 0,
            failed: 1,
            skipped: 0,
            total: 0,
            status: 'failed',
            output: `Error: ${error.message}\n\nMake sure npm test works in terminal.\n\nStack: ${error.stack || 'N/A'}`,
            exitCode: 1,
            testFiles: [],
            failedTests: []
          });
        }
      });
    }
  };
}
