import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

const args = process.argv.slice(2);
const customContentDir = args[0];
const customOutputFile = args[1];

const CONTENT_DIR = customContentDir || path.join(process.cwd(), 'content');
const OUTPUT_FILE = customOutputFile || path.join(process.cwd(), 'public', 'content.json');

async function generate() {
    const files = await glob('**/*.md', { cwd: CONTENT_DIR });
    const nodes = [];
    const folderSet = new Set();
    const fileMap = new Map(); // Map to store file nodes by ID

    // 1. Process files
    files.forEach((file) => {
        const filePath = path.join(CONTENT_DIR, file);
        const source = fs.readFileSync(filePath, 'utf8');
        const { data, content } = matter(source);

        // Normalize ID: replace backslashes, remove extension
        const id = file.replace(/\\/g, '/').replace(/\.md$/, '');
        const segments = id.split('/');
        const fileName = segments[segments.length - 1];

        // Add parent folders to set
        for (let i = 1; i < segments.length; i++) {
            const folderPath = segments.slice(0, i).join('/');
            folderSet.add(folderPath);
        }

        const stats = fs.statSync(filePath);
        const date = data.date ? new Date(data.date).toISOString().split('T')[0] : stats.birthtime.toISOString().split('T')[0];

        const node = {
            id,
            title: data.title || fileName,
            slug: data.slug,
            filePath: `content/${file}`, // Relative path for loading content
            category: data.category || segments[0] || 'General',
            tags: data.tags || [],
            date,
            content,
            parentId: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
            isFolder: false,
            fileName: fileName + '.md' // Store actual filename for matching
        };
        nodes.push(node);
        fileMap.set(id, node);
    });

    // 2. Process folders
    const folderNodes = [];
    folderSet.forEach(folderId => {
        const segments = folderId.split('/');
        const folderName = segments[segments.length - 1];
        folderNodes.push({
            id: folderId,
            title: folderName,
            parentId: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
            isFolder: true,
            category: segments[0] || 'System',
            children: [],
            fileName: folderName // Store folder name for matching
        });
    });
    nodes.push(...folderNodes);

    // 3. Handle _meta.json for sorting
    // Get all unique directory paths (including root)
    const allDirs = new Set(['.']);
    folderSet.forEach(f => allDirs.add(f));

    for (const dir of allDirs) {
        const dirPath = path.join(CONTENT_DIR, dir);
        const metaPath = path.join(dirPath, '_meta.json');

        // Get items in this directory
        const itemsInDir = nodes.filter(n => {
            if (dir === '.') return n.parentId === null;
            return n.parentId === dir;
        });

        if (itemsInDir.length === 0) continue;

        let meta = [];
        let hasChanges = false;

        // Read existing _meta.json
        if (fs.existsSync(metaPath)) {
            try {
                meta = fs.readJSONSync(metaPath);
            } catch (e) {
                console.warn(`Failed to read ${metaPath}, creating new one.`);
            }
        }

        // Get current filenames/foldernames
        const currentNames = itemsInDir.map(n => n.fileName || (n.isFolder ? n.title : n.id.split('/').pop() + '.md'));

        // Append new items to meta
        currentNames.forEach(name => {
            // Check if name (or name without extension for files) is in meta
            // Actually, let's store exact filenames/foldernames in meta for precision
            // But user might prefer "Schrodinger" over "Schrodinger.md"
            // Let's stick to simple names: "Schrodinger" for Schrodinger.md, "Physics" for Physics folder

            const simpleName = name.replace(/\.md$/, '');
            if (!meta.includes(simpleName)) {
                meta.push(simpleName);
                hasChanges = true;
            }
        });

        // Write back if changed or new
        if (hasChanges || !fs.existsSync(metaPath)) {
            // Sort only if creating new (optional, but good for initial state)
            if (!fs.existsSync(metaPath)) {
                meta.sort((a, b) => {
                    // Folders first? Or alphabetical? Let's do alphabetical for now
                    return a.localeCompare(b);
                });
            }
            fs.outputJSONSync(metaPath, meta, { spaces: 2 });
            console.log(`Updated ${metaPath}`);
        }

        // Assign sortIndex to nodes
        itemsInDir.forEach(node => {
            const simpleName = (node.fileName || node.title).replace(/\.md$/, '');
            const index = meta.indexOf(simpleName);
            node.sortIndex = index !== -1 ? index : 9999;
        });
    }

    // Read config
    let config = { title: "MetaWiki" };
    const configPath = path.join(CONTENT_DIR, '_config.json');
    if (fs.existsSync(configPath)) {
        try {
            const configContent = fs.readFileSync(configPath, 'utf-8');
            config = JSON.parse(configContent);
        } catch (e) {
            console.error("Failed to read config:", e);
        }
    }

    const output = {
        nodes: nodes,
        config: config
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`Generated content.json with ${nodes.length} items`);
}

generate();