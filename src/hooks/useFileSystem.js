import { useState, useEffect, useCallback } from 'react';
import { isElectron, readFile, writeFile, createFile, deleteFile, createDir, renamePath } from '../utils/fileSystem';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';

export const useFileSystem = () => {
    const [notes, setNotes] = useState([]);
    const [wikiConfig, setWikiConfig] = useState({ title: "MetaWiki" });
    const [loading, setLoading] = useState(true);

    const loadNotes = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            if (isElectron()) {
                // Use new IPC to get content from ContentManager
                const { nodes, config } = await window.electronAPI.getContent();
                setNotes(nodes || []);
                setWikiConfig(config || {});
            } else {
                const response = await fetch(`${import.meta.env.BASE_URL}content.json?t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                });
                if (!response.ok) throw new Error('Failed to load content');
                const data = await response.json();

                // Handle new format { nodes: [], config: {} } vs old format []
                if (Array.isArray(data)) {
                    setNotes(data);
                } else if (data.nodes) {
                    setNotes(data.nodes);
                    if (data.config) setWikiConfig(data.config);
                }
            }
        } catch (err) {
            console.error("Failed to load content:", err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);



    const handleCreateFile = async (name, parentId = null) => {
        if (!isElectron() || !name) return;

        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        // Construct path based on parentId
        const parentPath = parentId ? `content/${parentId}` : 'content';
        const filePath = `${parentPath}/${fileName}`;

        try {
            // Create file with YAML frontmatter
            // User requested: Input name = filename. Page title = YAML title (initially same as filename or empty).
            // We'll set initial YAML title to filename for convenience, but it can be changed independently.
            const initialTitle = name.replace('.md', '');
            const initialSlug = initialTitle.toLowerCase()
                .replace(/[^\w\s-]/g, '') // Remove non-word chars (except space and hyphen)
                .replace(/\s+/g, '-')     // Replace spaces with hyphens
                .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
            const initialCategory = parentId ? parentId.split('/')[0] : 'General';
            const initialDate = new Date().toISOString().split('T')[0];

            const fileContent = `---
title: ${initialTitle}
slug: ${initialSlug}
date: ${initialDate}
tags: []
category: ${initialCategory}
---

`;
            await createFile(filePath, fileContent);

            // Update local state
            const newNote = {
                id: parentId ? `${parentId}/${name.replace('.md', '')}` : name.replace('.md', ''),
                title: initialTitle,
                slug: initialSlug,
                filePath: `${parentPath}/${fileName}`, // Add filePath
                category: initialCategory, // Simple category logic
                tags: [],
                date: initialDate,
                content: fileContent,
                parentId: parentId,
                isFolder: false,
                fileName: fileName
            };

            setNotes(prev => [...prev, newNote]);

            // Update _meta.json in the specific directory
            await updateMeta(parentId, newNote.title); // Use title (no extension) for meta as per previous logic

            // Trigger content regeneration
            await window.electronAPI.runGenerator();

        } catch (error) {
            alert("Failed to create file: " + error.message);
        }
    };

    const handleCreateDir = async (name, parentId = null) => {
        if (!isElectron() || !name) return;

        const parentPath = parentId ? `content/${parentId}` : 'content';
        const dirPath = `${parentPath}/${name}`;

        try {
            await createDir(dirPath);

            const newFolder = {
                id: parentId ? `${parentId}/${name}` : name,
                title: name,
                category: parentId ? parentId.split('/')[0] : 'System',
                parentId: parentId,
                isFolder: true,
                children: [],
                fileName: name
            };
            setNotes(prev => [...prev, newFolder]);
            await updateMeta(parentId, name);

        } catch (error) {
            alert("Failed to create folder: " + error.message);
        }
    };

    const handleDelete = async (item) => {
        if (!isElectron()) return;
        // Confirmation handled in UI

        try {
            // Construct path
            // item.id is like 'Physics/Schrodinger'
            // We need to know if it's a file or folder to append extension?
            // item.fileName should have it.

            // If item has parentId, path is content/parentId/fileName
            // If root, content/fileName

            const parentPath = item.parentId ? `content/${item.parentId}` : 'content';
            const filePath = `${parentPath}/${item.fileName}`;

            // If it's a folder, we might need recursive delete?
            // fs.unlink only works for files. fs.rm for dirs.
            // Our deleteFile implementation uses fs.unlink.
            // We need deleteDir? Or check if folder.
            // For now let's assume files only or empty folders.
            // Actually, let's just try deleteFile. If it's a dir, it might fail if not empty.

            await deleteFile(filePath);

            setNotes(prev => prev.filter(n => n.id !== item.id));

            // Update _meta.json
            await removeFromMeta(item.parentId, item.fileName.replace('.md', ''));

            // Trigger content regeneration
            await window.electronAPI.runGenerator();

        } catch (error) {
            alert("Failed to delete: " + error.message);
        }
    };

    const handleRename = async (item, newName) => {
        if (!isElectron() || !newName || newName === item.title) return;

        try {
            const parentPath = item.parentId ? `content/${item.parentId}` : 'content';
            const oldFileName = item.fileName;

            // Determine new filename
            let newFileName = newName;
            if (!item.isFolder && !newName.endsWith('.md')) {
                newFileName = `${newName}.md`;
            }

            const oldPath = `${parentPath}/${oldFileName}`;
            const newPath = `${parentPath}/${newFileName}`;

            // 0. Update YAML content (Title & Slug) before renaming
            if (!item.isFolder) {
                try {
                    const content = await readFile(oldPath);
                    const { metadata, body } = parseFrontmatter(content);

                    const newSlug = newName.replace('.md', '').toLowerCase().replace(/\s+/g, '-');

                    const newMetadata = {
                        ...metadata,
                        title: newName.replace('.md', ''),
                        slug: newSlug
                    };

                    const newContent = stringifyFrontmatter(newMetadata, body);
                    await writeFile(oldPath, newContent);
                } catch (e) {
                    console.error("Failed to update YAML during rename", e);
                }
            }

            // 1. Rename on disk
            await renamePath(oldPath, newPath);

            // 2. Update _meta.json
            // We need to remove the old name and add the new name (without extension)
            // Ideally, we keep the position?
            // Let's try to replace it in place to preserve order.
            const metaPath = `${parentPath}/_meta.json`;
            try {
                const content = await readFile(metaPath);
                let meta = JSON.parse(content);
                const oldNameNoExt = oldFileName.replace('.md', '');
                const newNameNoExt = newFileName.replace('.md', '');

                const index = meta.indexOf(oldNameNoExt);
                if (index !== -1) {
                    meta[index] = newNameNoExt;
                    await writeFile(metaPath, JSON.stringify(meta, null, 2));
                }
            } catch (e) {
                console.warn("Failed to update _meta.json during rename", e);
            }

            // 3. Optimistic State Update
            // We need to update the notes array immediately so the UI doesn't try to access the old file
            const newId = item.parentId ? `${item.parentId}/${newName.replace('.md', '')}` : newName.replace('.md', '');
            const newSlug = newName.replace('.md', '').toLowerCase().replace(/\s+/g, '-');

            setNotes(prev => prev.map(n => {
                if (n.id === item.id) {
                    return {
                        ...n,
                        id: newId,
                        title: newName.replace('.md', ''),
                        slug: newSlug,
                        fileName: newFileName,
                        filePath: `${parentPath}/${newFileName}`
                    };
                }
                // If it's a folder, we technically need to update all children's IDs and parentIds
                // This is complex. For now, let's assume file rename or simple folder rename.
                // If folder, children paths are broken until reload.
                return n;
            }));

            // 4. Regenerate content and reload (background)
            // We don't await this to block the UI update, but we should ensure consistency eventually.
            window.electronAPI.runGenerator().then(() => loadNotes());

            return newId;

        } catch (error) {
            alert("Failed to rename: " + error.message);
            return null;
        }
    };

    const handleReorder = async (item, direction) => {
        if (!isElectron()) return;

        // 1. Get siblings
        const siblings = notes.filter(n => n.parentId === item.parentId).sort((a, b) => {
            // Use current sortIndex
            return (a.sortIndex || 0) - (b.sortIndex || 0);
        });

        const currentIndex = siblings.findIndex(n => n.id === item.id);
        if (currentIndex === -1) return;

        const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (swapIndex < 0 || swapIndex >= siblings.length) return;

        const siblingToSwap = siblings[swapIndex];

        // 2. Swap sortIndex in local state
        const newNotes = [...notes];
        const itemNode = newNotes.find(n => n.id === item.id);
        const swapNode = newNotes.find(n => n.id === siblingToSwap.id);

        const tempIndex = itemNode.sortIndex;
        itemNode.sortIndex = swapNode.sortIndex;
        swapNode.sortIndex = tempIndex;

        setNotes(newNotes);

        // 3. Update _meta.json
        // We need the list of names in order.
        // Re-sort siblings based on new sortIndex
        const sortedSiblings = siblings.map(s => {
            if (s.id === item.id) return itemNode;
            if (s.id === siblingToSwap.id) return swapNode;
            return s;
        }).sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0));

        const metaNames = sortedSiblings.map(s => s.fileName.replace('.md', ''));

        const parentPath = item.parentId ? `content/${item.parentId}` : 'content';
        const metaPath = `${parentPath}/_meta.json`;

        try {
            await writeFile(metaPath, JSON.stringify(metaNames, null, 2));
            // Trigger content regeneration
            await window.electronAPI.runGenerator();
        } catch (error) {
            console.error("Failed to update _meta.json", error);
        }
    };

    // Helper to update _meta.json
    const updateMeta = async (parentId, nameToAdd) => {
        const parentPath = parentId ? `content/${parentId}` : 'content';
        const metaPath = `${parentPath}/_meta.json`;

        let meta = [];
        try {
            const content = await readFile(metaPath);
            meta = JSON.parse(content);
        } catch (e) {
            // File might not exist
        }

        if (!meta.includes(nameToAdd)) {
            meta.push(nameToAdd);
            await writeFile(metaPath, JSON.stringify(meta, null, 2));
        }
    };

    const saveConfig = async (newConfig) => {
        if (!isElectron()) return;
        try {
            // Update local state
            setWikiConfig(prev => ({ ...prev, ...newConfig }));

            // Save to disk via IPC
            // We need a new IPC handler for this, or use writeFile to update _config.json
            // Let's use writeFile to content/_config.json
            const configPath = 'content/_config.json';
            await writeFile(configPath, JSON.stringify(newConfig, null, 2));

            // Trigger generator to update content.json
            // No longer needed with ContentManager watcher
            // const result = await window.electronAPI.runGenerator();
            // if (!result.success) {
            //     alert("Failed to regenerate content: " + result.error);
            // }
        } catch (error) {
            console.error("Failed to save config:", error);
            alert("Failed to save settings: " + error.message);
        }
    };

    const removeFromMeta = async (parentId, nameToRemove) => {
        const parentPath = parentId ? `content/${parentId}` : 'content';
        const metaPath = `${parentPath}/_meta.json`;

        try {
            const content = await readFile(metaPath);
            let meta = JSON.parse(content);
            meta = meta.filter(n => n !== nameToRemove);
            await writeFile(metaPath, JSON.stringify(meta, null, 2));
        } catch (e) {
            console.error("Failed to update _meta.json", e);
        }
    };

    const handleMove = async (movedItemId, targetItemId, action) => {
        if (!isElectron()) return;

        // Find nodes
        const findNode = (id) => {
            // Flatten notes for search? Or just search recursively?
            // Since notes is flat list of all nodes (from content.json), we can just find.
            return notes.find(n => n.id === id);
        };

        const movedNode = findNode(movedItemId);
        const targetNode = targetItemId === 'root' ? { id: 'root', isFolder: true } : findNode(targetItemId);

        if (!movedNode || !targetNode) return;

        // Prevent moving into self or children (if folder)
        if (movedNode.isFolder && targetItemId !== 'root' && targetItemId.startsWith(movedItemId + '/')) {
            alert("Cannot move a folder into itself.");
            return;
        }

        try {
            const sourceParentId = movedNode.parentId;
            let targetParentId;

            if (targetItemId === 'root') {
                targetParentId = null;
            } else if (action === 'inside') {
                targetParentId = targetNode.id;
            } else {
                targetParentId = targetNode.parentId;
            }

            // Case 1: Moving to a different folder (or root)
            if (sourceParentId !== targetParentId) {
                // Ensure sourcePath is relative (starts with content/)
                // movedNode.filePath might be absolute if it came from a fresh load? 
                // Actually, our loadNotes sets it to relative usually.
                // But let's be safe and reconstruct it from ID/ParentID if possible, or just use what we have but ensure it's relative.

                // Better: Reconstruct sourcePath from parentId and fileName to be sure.
                const fileName = movedNode.fileName;
                const sourceDir = sourceParentId ? `content/${sourceParentId}` : 'content';
                const sourcePath = `${sourceDir}/${fileName}`;

                const targetDir = targetParentId ? `content/${targetParentId}` : 'content';
                const targetPath = `${targetDir}/${fileName}`;

                console.log(`Moving ${sourcePath} to ${targetPath}`); // Debug log

                // Move file/dir
                await renamePath(sourcePath, targetPath);

                // Update _meta.json in source
                await removeFromMeta(sourceParentId, movedNode.fileName.replace('.md', ''));

                // Update _meta.json in target
                // If 'inside', append to end.
                // If 'before'/'after', insert at specific position.
                // But 'before'/'after' implies we are in the target folder's list.
                // Wait, if sourceParentId !== targetParentId, and action is 'before'/'after',
                // it means we dragged from Folder A to position X in Folder B.

                await addToMeta(targetParentId, fileName.replace('.md', ''), targetItemId, action);

                // Update local state optimistically?
                // It's complex to update paths for all children if it's a folder.
                // Easiest is to reload.
                await window.electronAPI.runGenerator();
                await loadNotes();

            } else {
                // Case 2: Reordering within same folder

                // Edge case: If target is root (and we are in root), it's a no-op for reordering unless we want to move to end?
                // But targetNode would be the root object which has no fileName.
                if (targetItemId === 'root') return;

                // Only need to update _meta.json
                const parentPath = sourceParentId ? `content/${sourceParentId}` : 'content';
                const metaPath = `${parentPath}/_meta.json`;

                let meta = [];
                try {
                    const content = await readFile(metaPath);
                    meta = JSON.parse(content);
                } catch (e) {
                    // Should exist if we are reordering
                }

                const movedName = movedNode.fileName.replace('.md', '');
                const targetName = targetNode.fileName ? targetNode.fileName.replace('.md', '') : '';

                if (!targetName) return; // Safety check

                // Remove moved item
                meta = meta.filter(n => n !== movedName);

                // Insert at new position
                const targetIndex = meta.indexOf(targetName);
                if (targetIndex !== -1) {
                    if (action === 'before') {
                        meta.splice(targetIndex, 0, movedName);
                    } else {
                        meta.splice(targetIndex + 1, 0, movedName);
                    }
                } else {
                    meta.push(movedName);
                }

                await writeFile(metaPath, JSON.stringify(meta, null, 2));

                // Trigger generator
                await window.electronAPI.runGenerator();
                // We can also update local state sortIndex if we want instant feedback without reload
                // But generator is fast enough usually.
                await loadNotes();
            }

        } catch (error) {
            console.error("Move failed:", error);
            alert("Failed to move item: " + error.message);
            // Ensure we reload notes to sync UI with file system state
            await loadNotes();
        }
    };

    const addToMeta = async (parentId, nameToAdd, targetItemId, action) => {
        const parentPath = parentId ? `content/${parentId}` : 'content';
        const metaPath = `${parentPath}/_meta.json`;

        let meta = [];
        try {
            const content = await readFile(metaPath);
            meta = JSON.parse(content);
        } catch (e) {
            // Create if not exists
        }

        // If action is inside, just push (or we could support inside-at-index but UI usually just drops on folder)
        if (action === 'inside') {
            if (!meta.includes(nameToAdd)) {
                meta.push(nameToAdd);
            }
        } else {
            // Insert relative to target
            // targetItemId is the full ID, we need the filename part for meta lookup
            // But wait, targetItemId might be 'Folder/Subfolder/File'. 
            // If we are in 'Folder/Subfolder', the meta contains 'File'.
            const targetName = targetItemId.split('/').pop(); // This is a guess, safer to find node
            // But we don't have node here easily without passing it.
            // Let's rely on the fact that meta contains basenames.

            // Actually, we should check if targetName exists in meta.
            // If not, just push.

            // Let's refine:
            // We need to find the index of the target item in the meta list.
            // The target item's name in meta is its basename (no extension).

            // We need to look up the target node to get its filename properly?
            // Or just assume targetItemId's last part is the name?
            // IDs are paths without extension usually.
            const targetBaseName = targetItemId.split('/').pop();

            const targetIndex = meta.indexOf(targetBaseName);
            if (targetIndex !== -1) {
                if (action === 'before') {
                    meta.splice(targetIndex, 0, nameToAdd);
                } else {
                    meta.splice(targetIndex + 1, 0, nameToAdd);
                }
            } else {
                meta.push(nameToAdd);
            }
        }

        await writeFile(metaPath, JSON.stringify(meta, null, 2));
    };

    return {
        notes,
        loading,
        setNotes,
        loadNotes, // Expose loadNotes
        handleCreateFile,
        handleCreateDir,
        handleDelete,
        handleRename,
        handleReorder,
        handleMove,
        wikiConfig,
        saveConfig
    };
};
