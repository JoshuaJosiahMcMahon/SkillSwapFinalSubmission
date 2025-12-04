import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class UploadController {
    constructor() {
        this.uploadDir = path.join(__dirname, '../../public/uploads');
        this.maxFileSize = 5 * 1024 * 1024;
        this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    }

    async ensureUploadDir() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
        } catch (error) {
            console.error('Error creating upload directory:', error);
        }
    }

    async parseMultipartFormData(req) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let boundary = null;

            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                return reject(new Error('No boundary found in Content-Type'));
            }
            boundary = '--' + boundaryMatch[1].trim();

            req.on('data', chunk => {
                chunks.push(chunk);
            });

            req.on('end', () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    const parts = buffer.toString('binary').split(boundary);
                    const fields = {};
                    let fileData = null;
                    let fileName = null;
                    let fileType = null;

                    for (const part of parts) {
                        const trimmedPart = part.trim();
                        if (!trimmedPart || trimmedPart === '--') continue;

                        const headerEnd = trimmedPart.indexOf('\r\n\r\n');
                        if (headerEnd === -1) continue;

                        const headers = trimmedPart.substring(0, headerEnd);
                        const body = trimmedPart.substring(headerEnd + 4);

                        if (headers.includes('Content-Disposition')) {
                            const nameMatch = headers.match(/name="([^"]+)"/);
                            const filenameMatch = headers.match(/filename="([^"]+)"/);
                            const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);

                            if (nameMatch) {
                                const fieldName = nameMatch[1];

                                if (filenameMatch) {

                                    fileName = filenameMatch[1];
                                    fileType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

                                    const bodyEnd = body.endsWith('\r\n') ? body.length - 2 : body.length;
                                    fileData = Buffer.from(body.substring(0, bodyEnd), 'binary');
                                } else {

                                    const bodyEnd = body.endsWith('\r\n') ? body.length - 2 : body.length;
                                    fields[fieldName] = body.substring(0, bodyEnd);
                                }
                            }
                        }
                    }

                    resolve({ fields, fileData, fileName, fileType });
                } catch (error) {
                    reject(error);
                }
            });

            req.on('error', reject);
        });
    }

    async uploadProfilePicture(req, res, router) {
        try {
            const userId = router.requireAuth(req, res);
            if (!userId) {
                return router.sendJson(res, { error: 'Unauthorized' }, 401);
            }

            await this.ensureUploadDir();

            const { fields, fileData, fileName, fileType } = await this.parseMultipartFormData(req);

            if (!fileData || !fileName) {
                return router.sendJson(res, { error: 'No file uploaded' }, 400);
            }

            if (!this.allowedTypes.includes(fileType)) {
                return router.sendJson(res, {
                    error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
                }, 400);
            }

            if (fileData.length > this.maxFileSize) {
                return router.sendJson(res, {
                    error: 'File too large. Maximum size is 5MB.'
                }, 400);
            }

            const ext = path.extname(fileName).toLowerCase();
            const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
            const filePath = path.join(this.uploadDir, uniqueName);

            await fs.writeFile(filePath, fileData);

            const fileUrl = `/uploads/${uniqueName}`;

            router.sendJson(res, {
                success: true,
                url: fileUrl,
                fileName: uniqueName
            });
        } catch (error) {
            console.error('Error uploading file:', error);
            router.sendJson(res, { error: 'Failed to upload file' }, 500);
        }
    }
}
