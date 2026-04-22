import http from 'node:http';

// Creates a minimal HTTP dispatcher that delegates to route handlers.
export function createHttpServer(routes) {
  return http.createServer((req, res) => {
    const key = `${req.method} ${req.url.split('?')[0]}`;
    const handler = routes[key];
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    handler(req, res);
  });
}
