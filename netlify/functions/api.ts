import http from 'http';
import { Socket } from 'net';

// 1. Intercept http.createServer & server.listen before server.ts starts
let expressApp: any = null;
let resolveApp: (app: any) => void;
const appReady = new Promise<any>((resolve) => {
  resolveApp = resolve;
});

const origCreateServer = http.createServer;
(http as any).createServer = function (reqListener: any, ...args: any[]) {
  if (reqListener && typeof reqListener === 'function') {
    expressApp = reqListener;
    resolveApp(reqListener);
  }
  const server = origCreateServer.apply(this, [reqListener, ...args]);
  // Prevent server.listen from hanging or attempting port binding in serverless environment
  server.listen = function (...listenArgs: any[]) {
    const cb = listenArgs.find((a: any) => typeof a === 'function');
    if (cb) setImmediate(cb);
    return server;
  };
  return server;
};

// 2. Ensure NODE_ENV is production so server.ts skips Vite dev server middleware
process.env.NODE_ENV = 'production';

// 3. Stub out dev-only modules (Vite, Rollup) in serverless production runtime
try {
  const Module = require('module');
  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id: string, ...args: any[]) {
    if (id === 'vite' || id.startsWith('vite/') || id === 'rollup' || id.startsWith('rollup/')) {
      return {
        createServer: () => ({ middlewares: (_req: any, _res: any, next: any) => next?.() }),
      };
    }
    return origRequire.apply(this, [id, ...args]);
  };
} catch {
  // Ignore in environments where module interception is not available
}

// 4. Import server.ts WITHOUT ANY MODIFICATION TO server.ts
import '../../server.ts';

// 4. Serverless Netlify Function Handler
export const handler = async (event: any, context: any) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  const app = await appReady;

  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);

    // Normalize path:
    // Netlify rewrites "/api/*" -> "/.netlify/functions/api/:splat"
    let reqPath = event.path || '/';
    if (reqPath.startsWith('/.netlify/functions/api')) {
      reqPath = reqPath.replace(/^\/\.netlify\/functions\/api/, '') || '/';
    }
    if (!reqPath.startsWith('/api')) {
      reqPath = '/api' + (reqPath.startsWith('/') ? reqPath : '/' + reqPath);
    }

    // Append query parameters
    if (event.queryStringParameters && Object.keys(event.queryStringParameters).length > 0) {
      const q = new URLSearchParams(event.queryStringParameters).toString();
      if (q) {
        reqPath += (reqPath.includes('?') ? '&' : '?') + q;
      }
    }

    req.method = event.httpMethod || 'GET';
    req.url = reqPath;

    // Normalize headers
    const normHeaders: Record<string, string> = {};
    if (event.headers) {
      for (const [key, value] of Object.entries(event.headers)) {
        if (value !== undefined && value !== null) {
          normHeaders[key.toLowerCase()] = String(value);
        }
      }
    }

    // Push request body (supports JSON, forms, and base64 encoded multipart file uploads)
    if (event.body) {
      const bodyBuf = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body, 'utf8');
      normHeaders['content-length'] = String(bodyBuf.length);
      req.headers = normHeaders;
      req.push(bodyBuf);
    } else {
      req.headers = normHeaders;
    }

    req.complete = true;
    req.push(null);

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    res.assignSocket(socket);

    (res as any).write = function (chunk: any) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return true;
    };

    (res as any).end = function (chunk: any) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }

      const bodyBuffer = Buffer.concat(chunks);
      const resHeaders = res.getHeaders();
      const headersOutput: Record<string, string> = {};
      const multiValueHeadersOutput: Record<string, string[]> = {};

      for (const [key, val] of Object.entries(resHeaders)) {
        if (Array.isArray(val)) {
          multiValueHeadersOutput[key] = val.map(String);
          headersOutput[key] = val.join(', ');
        } else if (val !== undefined && val !== null) {
          headersOutput[key] = String(val);
        }
      }

      const contentType = (headersOutput['content-type'] || '').toLowerCase();
      const isBinary =
        contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        contentType.includes('application/pdf') ||
        contentType.includes('application/octet-stream');

      resolve({
        statusCode: res.statusCode || 200,
        headers: headersOutput,
        multiValueHeaders: multiValueHeadersOutput,
        body: isBinary ? bodyBuffer.toString('base64') : bodyBuffer.toString('utf8'),
        isBase64Encoded: isBinary,
      });
    };

    app(req, res);
  });
};
