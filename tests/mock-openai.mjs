import http from 'node:http';
import { mockResponse } from './mock-provider.mjs';
http
  .createServer(async (req, res) => {
    if (req.method === 'GET') {
      res.end('Test provider ready');
      return;
    }
    let raw = '';
    for await (const c of req) raw += c;
    try {
      const b = JSON.parse(raw);
      if (typeof b.input === 'string' && b.input.includes('DELAYED_FEEDBACK_TEST')) {
        await new Promise((resolve) => setTimeout(resolve, 3500));
      }
      if (b.input?.includes?.('SERVICE_OUTAGE_TEST')) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Test outage', type: 'server_error' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockResponse(b)));
    } catch {
      res.writeHead(400);
      res.end('{}');
    }
  })
  .listen(4011, '127.0.0.1', () => console.log('Test-only provider on 4011'));
