import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import matter from 'gray-matter';
import { glob } from 'glob';
import { app } from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ContentManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.contentPath = null;
        this.index = [];
        this.watcher = null;
        this.config = {};
        this.isDev = !app.isPackaged;
    }

    async initialize(contentPath) {
        this.contentPath = contentPath;
        console.log(`[ContentManager] Initializing with path: ${this.contentPath}`);

        // 1. Initial Scan
        await this.scan();

        // 2. Start Watcher
        this.startWatcher();

        // 3. Sync for Dev (Optional)
        if (this.isDev) {
            await this.syncToPublic();
        }
    }

    async scan() {
        console.log('[ContentManager] Scanning content...');
        try {
            // Read config
            const configPath = path.join(this.contentPath, '_config.json');
            if (await fs.pathExists(configPath)) {
                try {
                    this.config = await fs.readJson(configPath);
                } catch (e) {
                    console.error('[ContentManager] Failed to read _config.json:', e);
                }
            }

            // Read meta
            let meta = {};
            const metaPath = path.join(this.contentPath, '_meta.json');
            if (await fs.pathExists(metaPath)) {
                try {
                    meta = await fs.readJson(metaPath);
                } catch (e) {
                    console.error('[ContentManager] Failed to read _meta.json:', e);
                }
            }

            // Find all markdown files
            const files = await glob('**/*.md', { cwd: this.contentPath, ignore: 'node_modules/**' });
            // Find all directories
            const dirs = await glob('**/', { cwd: this.contentPath, ignore: 'node_modules/**' });

            const nodes = [];
            const processedDirs = new Set();

            // Process explicit directories first
            for (const dir of dirs) {
                const dirPath = dir.replace(/\\/g, '/').replace(/\/$/, '');
                if (!dirPath || dirPath === '.') continue;

                if (!processedDirs.has(dirPath)) {
                    processedDirs.add(dirPath);
                    const pathParts = dirPath.split('/');
                    const folderName = pathParts[pathParts.length - 1];
                    const parentDir = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : null;

                    const folderNode = {
                        id: dirPath,
                        title: folderName,
                        isFolder: true,
                        parentId: parentDir,
                        sortIndex: 999,
                        children: [],
                        fileName: folderName
                    };
                    nodes.push(folderNode);
                }
            }

            for (const file of files) {
                const relativePath = file;
                const fullPath = path.join(this.contentPath, relativePath);
                // const stats = await fs.stat(fullPath); // Unused

                const content = await fs.readFile(fullPath, 'utf-8');
                const { data, content: body } = matter(content);

                // Sanitize data to ensure no Date objects (which crash React)
                const safeData = {};
                for (const key in data) {
                    const value = data[key];
                    if (value instanceof Date) {
                        safeData[key] = value.toISOString().split('T')[0];
                    } else {
                        safeData[key] = value;
                    }
                }

                const pathParts = relativePath.split('/');
                const fileName = pathParts.pop();
                const dirPath = pathParts.join('/');
                const id = dirPath ? `${dirPath}/${fileName.replace('.md', '')}` : fileName.replace('.md', '');

                // Create Node
                const rawTitle = safeData.title || fileName.replace('.md', '');
                const title = String(rawTitle); // Ensure title is string

                const node = {
                    id: id,
                    title: title,
                    isFolder: false,
                    parentId: dirPath || null,
                    slug: safeData.slug || id,
                    sortIndex: safeData.sortIndex || 999,
                    fileName: fileName,
                    filePath: `content/${relativePath}`, // Keep relative for frontend compatibility
                    content: body, // In-memory cache includes content? Yes for small wikis.
                    ...safeData
                };

                nodes.push(node);

                // Create Folder Nodes
                let currentDir = '';
                for (const part of pathParts) {
                    const parentDir = currentDir;
                    currentDir = currentDir ? `${currentDir}/${part}` : part;

                    if (!processedDirs.has(currentDir)) {
                        processedDirs.add(currentDir);

                        // Check for folder meta/config if needed, or just create stub
                        const folderNode = {
                            id: currentDir,
                            title: part,
                            isFolder: true,
                            parentId: parentDir || null,
                            sortIndex: 999,
                            children: []
                        };

                        // Apply meta sorting if available
                        if (meta[currentDir]) {
                            // Logic to apply meta to folder... 
                            // For now simple stub
                        }

                        nodes.push(folderNode);
                    }
                }
            }

            // Group nodes by parentId (directory)
            const nodesByParent = {};
            nodes.forEach(node => {
                const parentId = node.parentId || 'root';
                if (!nodesByParent[parentId]) nodesByParent[parentId] = [];
                nodesByParent[parentId].push(node);
            });

            // Apply sorting from _meta.json for each directory
            for (const [parentId, groupNodes] of Object.entries(nodesByParent)) {
                const dirPath = parentId === 'root' ? this.contentPath : path.join(this.contentPath, parentId);
                const metaPath = path.join(dirPath, '_meta.json');

                if (await fs.pathExists(metaPath)) {
                    try {
                        const meta = await fs.readJson(metaPath);
                        if (Array.isArray(meta)) {
                            groupNodes.forEach(node => {
                                const simpleName = (node.fileName || node.title).replace(/\.md$/, '');
                                const index = meta.indexOf(simpleName);
                                node.sortIndex = index !== -1 ? index : 9999;
                            });
                        }
                    } catch (e) {
                        console.error(`[ContentManager] Failed to read meta for ${parentId}:`, e);
                    }
                }
            }

            this.index = nodes;
            this.notifyFrontend();

            if (this.isDev) {
                await this.syncToPublic();
            }

        } catch (error) {
            console.error('[ContentManager] Scan failed:', error);
        }
    }

    startWatcher() {
        if (this.watcher) {
            this.watcher.close();
        }

        console.log('[ContentManager] Starting watcher...');
        this.watcher = chokidar.watch(this.contentPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });

        this.watcher
            .on('add', async path => { console.log(`File ${path} has been added`); await this.scan(); })
            .on('change', async path => { console.log(`File ${path} has been changed`); await this.scan(); })
            .on('unlink', async path => { console.log(`File ${path} has been removed`); await this.scan(); })
            .on('addDir', async path => { console.log(`Directory ${path} has been added`); await this.scan(); })
            .on('unlinkDir', async path => { console.log(`Directory ${path} has been removed`); await this.scan(); });
    }

    notifyFrontend() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            console.log('[ContentManager] Sending update to frontend');
            this.mainWindow.webContents.send('content-updated', {
                nodes: this.index,
                config: this.config
            });
        }
    }

    async syncToPublic() {
        // Write content.json to public/ for Dev Server
        const publicPath = path.join(process.cwd(), 'public', 'content.json');
        const output = {
            config: this.config,
            nodes: this.index
        };
        try {
            await fs.writeJson(publicPath, output, { spaces: 2 });
            console.log('[ContentManager] Synced to public/content.json');
        } catch (e) {
            console.error('[ContentManager] Failed to sync public:', e);
        }
    }

    getContent() {
        return {
            nodes: this.index,
            config: this.config
        };
    }

    dispose() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}

export default ContentManager;
