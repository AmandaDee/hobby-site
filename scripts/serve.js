'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8'
};

function createServer() {
  return http.createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {Allow: 'GET, HEAD'});
      response.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const target = path.resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(404);
        response.end();
        return;
      }
      let content;
      let status = 200;
      let type = types[path.extname(target)] || 'application/octet-stream';
      try {
        content = await fs.readFile(target);
      } catch (error) {
        if (!['ENOENT', 'EISDIR'].includes(error.code)) throw error;
        content = await fs.readFile(path.join(root, '404.html'));
        status = 404;
        type = types['.html'];
      }
      response.writeHead(status, {'Content-Type': type, 'X-Content-Type-Options': 'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 500);
      response.end('Unable to serve this request.');
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8000);
  createServer().listen(port, '127.0.0.1', () => console.log(`Portfolio: http://localhost:${port}`));
}
module.exports = {createServer};
