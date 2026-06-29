import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  plugins: [{
    name: 'bao-cao-static-dashboard',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
        if (path !== '/bao-cao' && !path.startsWith('/bao-cao/')) return next();
        const html = readFileSync(resolve(__dirname, 'public/dashboard.html'), 'utf8');
        const transformed = await server.transformIndexHtml(req.url || '/bao-cao', html);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(transformed);
      });
    }
  }],
  server: {
    watch: {
      ignored: ['**/public/images/*.png']
    }
  }
});
