import http from 'http';
import url from 'url';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Database } from './src/config/database.js';
import { ApiRouter } from './src/routes/apiRouter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class App {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.database = null;
        this.router = new ApiRouter();
    }

    async initializeDatabase() {
        try {
            this.database = Database.getInstance();
            console.log('✓ Database connection initialized');
        } catch (error) {
            console.error('✗ Database initialization failed:', error.message);
            throw error;
        }
    }

    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    async serveStaticFile(filePath, res) {
        try {
            const fullPath = path.join(__dirname, 'public', filePath);
            const data = await fs.readFile(fullPath);
            const mimeType = this.getMimeType(filePath);
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        }
    }

    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method;

        const origin = req.headers.origin || '*';
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (pathname.startsWith('/api/')) {
            await this.router.handle(req, res);
            return;
        }

        if (pathname.startsWith('/uploads/')) {
            await this.serveStaticFile(pathname, res);
            return;
        }

        if (pathname === '/' || pathname === '/index.html') {
            await this.serveStaticFile('index.html', res);
        } else if (pathname.endsWith('.html') || pathname.endsWith('.css') || pathname.endsWith('.js')) {
            await this.serveStaticFile(pathname, res);
        } else {

            await this.serveStaticFile('index.html', res);
        }
    }

    async start() {
        try {
            await this.initializeDatabase();

            const server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            server.listen(this.port, () => {
                console.log(`\n🚀 SkillSwap server running on http://localhost:${this.port}`);
                console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}\n`);
            });
        } catch (error) {
            console.error('Failed to start application:', error);
            process.exit(1);
        }
    }
}

const application = new App();
application.start();
