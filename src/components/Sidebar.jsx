import React, { useState } from 'react';
import {
    Search,
    Folder,
    FolderOpen,
    FileText,
    ChevronRight,
    ChevronDown,
    Plus,
    MoreVertical,
    Trash2,
    Edit2,
    ArrowUp,
    ArrowDown,
    Tag,
    X,
    Sun,
    Moon,
    Settings
} from 'lucide-react';
import { isElectron } from '../utils/fileSystem';

const ContextMenu = ({ x, y, onClose, onAction, item, isFirst, isLast }) => {
    if (!item) return null;

    // If not in Electron, we might not want to show any context menu, 
    // or only read-only options if there were any. 
    // For now, since all actions are modification actions, we return null for web.
    if (!isElectron()) return null;

    return (
        <div
            className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-md py-1 w-48"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => onAction('createFile', item)}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
                <Plus size={14} /> New Page
            </button>
            <button
                onClick={() => onAction('createDir', item)}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
                <Folder size={14} /> New Folder
            </button>
            <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>

            <button
                onClick={() => onAction('rename', item)}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
                <Edit2 size={14} /> Rename
            </button>

            <button
                onClick={() => onAction('delete', item)}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
                <Trash2 size={14} /> Delete
            </button>
            <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
            <button
                onClick={() => onAction('moveUp', item)}
                disabled={isFirst}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isFirst ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
            >
                <ArrowUp size={14} /> Move Up
            </button>
            <button
                onClick={() => onAction('moveDown', item)}
                disabled={isLast}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isLast ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
            >
                <ArrowDown size={14} /> Move Down
            </button>
        </div>
    );
};

const TreeNode = ({ node, level = 0, activeNoteId, onSelect, expandedNodes, toggleNode, onContextMenu }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.includes(node.id);
    const isActive = activeNoteId === node.id;

    const handleContextMenu = (e) => {
        e.preventDefault();
        onContextMenu(e, node);
    };

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 px-3 py-1.5 my-0.5 rounded-md cursor-pointer text-sm transition-colors group relative ${isActive && !node.isFolder
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
                onClick={() => {
                    if (hasChildren || node.isFolder) {
                        toggleNode(node.id);
                    } else {
                        onSelect(node.slug || node.id);
                    }
                }}
                onContextMenu={handleContextMenu}
            >
                <span className="opacity-70 flex-shrink-0">
                    {hasChildren || node.isFolder ? (
                        isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : <span className="w-3.5 inline-block" />}
                </span>

                <span className="opacity-70 flex-shrink-0">
                    {node.isFolder
                        ? (isExpanded ? <FolderOpen size={16} className="text-indigo-500" /> : <Folder size={16} className="text-slate-400" />)
                        : <FileText size={16} />}
                </span>

                <span className="truncate flex-1">{node.title}</span>

                {/* Context Menu Trigger (visible on hover) - Electron Only */}
                {isElectron() && (
                    <button
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                        onClick={(e) => {
                            e.stopPropagation();
                            onContextMenu(e, node);
                        }}
                    >
                        <MoreVertical size={12} />
                    </button>
                )}
            </div>

            {isExpanded && hasChildren && (
                <div>
                    {node.children.map((child, index) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            activeNoteId={activeNoteId}
                            onSelect={onSelect}
                            expandedNodes={expandedNodes}
                            toggleNode={toggleNode}
                            onContextMenu={onContextMenu}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const Sidebar = ({
    treeData,
    activeNoteId,
    onNavigate,
    expandedNodes,
    toggleNode,
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    isMobileMenuOpen,
    darkMode,
    setDarkMode,
    flatFilteredNotes,
    onCreateFile,
    onCreateDir,
    onDelete,
    onRename,
    onReorder,
    wikiTitle,
    onOpenSettings
}) => {
    const [contextMenu, setContextMenu] = useState(null);

    const handleContextMenu = (e, node) => {
        e.preventDefault();
        // Find siblings to determine if first/last
        // This is a bit expensive, maybe pass index/siblings down?
        // For now, let's just pass the node and handle logic in parent or here if we have the tree.
        // We can find the parent in the tree.

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            item: node
        });
    };

    const handleAction = (action, item) => {
        setContextMenu(null);
        if (action === 'delete') onDelete(item);
        if (action === 'rename') onRename(item);
        if (action === 'moveUp') onReorder(item, 'up');
        if (action === 'moveDown') onReorder(item, 'down');
        if (action === 'createFile') onCreateFile(item);
        if (action === 'createDir') onCreateDir(item);
    };

    // Close context menu on click outside
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-10 w-64 h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 flex flex-col flex-shrink-0`}>
            <div className="p-5 hidden md:flex items-center justify-between border-b border-transparent">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-8 h-8" />
                    {wikiTitle}
                </h1>
                <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                </button>
            </div>

            {/* Actions Bar (Electron Only) - REMOVED as per user request, moved to Explorer header */}
            {/* 
            {isElectron() && (
                <div className="px-3 mb-2 flex gap-2">
                    ...
                </div>
            )} 
            */}

            {/* Search & Tag Indicator */}
            <div className="px-3 mb-2 space-y-2">
                <div className="relative group">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Quick find..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-slate-800 dark:text-slate-200"
                    />
                </div>
                {selectedTag && (
                    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-md text-xs font-medium border border-indigo-100 dark:border-indigo-800/50">
                        <span className="flex items-center gap-1"><Tag size={10} /> {selectedTag}</span>
                        <button onClick={() => setSelectedTag(null)} className="hover:text-indigo-900 dark:hover:text-indigo-100"><X size={12} /></button>
                    </div>
                )}
            </div>

            {/* Navigation Content */}
            <nav className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
                {(searchQuery || selectedTag) ? (
                    <div className="mt-2">
                        <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Search Results
                        </div>
                        {flatFilteredNotes && flatFilteredNotes.length > 0 ? (
                            flatFilteredNotes.map(note => (
                                <div
                                    key={note.id}
                                    onClick={() => onNavigate(note.slug || note.id)}
                                    className="flex flex-col gap-1 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{note.title}</span>
                                    <span className="text-xs text-slate-400 truncate">{note.content.substring(0, 40)}...</span>
                                </div>
                            ))
                        ) : (
                            <div className="px-3 text-sm text-slate-400 italic">No notes found.</div>
                        )}
                    </div>
                ) : (
                    <div className="mt-2">
                        {/* Explorer Header - Click to clear selection (Root) */}
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            onClick={() => {
                                // Clear active note to allow root creation
                                // We need a way to tell parent to clear activeNoteId
                                // For now, we can just expose a prop or use the "New Page" button logic
                                // Actually, let's add a "+" button here for Root creation explicitly
                            }}
                        >
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Explorer</span>
                            {isElectron() && (
                                <div className="flex gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCreateFile(null); // Pass null for root
                                        }}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                                        title="New Page in Root"
                                    >
                                        <Plus size={14} className="text-slate-500" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCreateDir(null); // Pass null for root
                                        }}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                                        title="New Folder in Root"
                                    >
                                        <Folder size={14} className="text-slate-500" />
                                    </button>
                                </div>
                            )}
                        </div>            {treeData.map((node, index) => (
                            <TreeNode
                                key={node.id}
                                node={node}
                                activeNoteId={activeNoteId}
                                onSelect={(id) => onNavigate(id)}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                onContextMenu={handleContextMenu}
                            />
                        ))}
                    </div>
                )}
            </nav>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    onAction={handleAction}
                    onClose={() => setContextMenu(null)}
                // We can pass isFirst/isLast if we calculate it
                />
            )}

            {/* Settings Button (Electron Only) */}
            {isElectron() && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={onOpenSettings}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                    >
                        <Settings size={16} />
                        Settings
                    </button>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
