import React, { useState, useMemo } from 'react';
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
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    useDroppable
} from '@dnd-kit/core';
import {
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    SortableContext,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isElectron } from '../utils/fileSystem';

const ContextMenu = ({ x, y, onClose, onAction, item, isFirst, isLast }) => {
    if (!item) return null;

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

const SortableTreeItem = ({ node, level = 0, activeNoteId, onSelect, expandedNodes, toggleNode, onContextMenu, dragOverInfo }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: node.id, data: node });

    const style = {
        transform: isDragging ? CSS.Translate.toString(transform) : undefined, // Only move the dragged item, keep others static for insertion line
        transition,
        paddingLeft: `${level * 12 + 12}px`,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 999 : 'auto'
    };

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.includes(node.id);
    const isActive = activeNoteId === node.id;

    const handleContextMenu = (e) => {
        e.preventDefault();
        onContextMenu(e, node);
    };

    // Visual Feedback based on dragOverInfo
    const isOver = dragOverInfo?.overId === node.id;
    const dropPosition = isOver ? dragOverInfo.position : null;

    return (
        <div className="select-none relative">
            {/* Drop Indicators */}
            {dropPosition === 'top' && (
                <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none flex items-center" style={{ marginLeft: `${level * 12}px` }}>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full -ml-0.5"></div>
                    <div className="h-0.5 bg-indigo-500 flex-1"></div>
                </div>
            )}

            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`flex items-center gap-2 px-3 py-1.5 my-0.5 rounded-md cursor-pointer text-sm transition-colors group relative 
                    ${isActive && !node.isFolder
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }
                    ${dropPosition === 'inside' ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/50 z-10' : ''}
                `}
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

            {dropPosition === 'bottom' && (
                <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex items-center" style={{ marginLeft: `${level * 12}px` }}>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full -ml-0.5"></div>
                    <div className="h-0.5 bg-indigo-500 flex-1"></div>
                </div>
            )}

            {isExpanded && hasChildren && (
                <SortableContext items={node.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div>
                        {node.children.map((child) => (
                            <SortableTreeItem
                                key={child.id}
                                node={child}
                                level={level + 1}
                                activeNoteId={activeNoteId}
                                onSelect={onSelect}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                onContextMenu={onContextMenu}
                                dragOverInfo={dragOverInfo}
                            />
                        ))}
                    </div>
                </SortableContext>
            )}
        </div>
    );
};

const RootDroppable = ({ children, isElectron, onCreateFile, onCreateDir, dragOverInfo }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'root-drop-zone',
    });

    // We can also use dragOverInfo here if we want consistent styling logic, 
    // but useDroppable is simple enough for the root header.
    // Actually, let's check if we are dragging over root in dragOverInfo to show highlight.
    const isRootOver = isOver || (dragOverInfo?.overId === 'root-drop-zone');

    return (
        <div
            ref={setNodeRef}
            className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isRootOver ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-inset ring-indigo-500/50' : ''}`}
            onClick={() => { }}
        >
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Explorer</span>
            {isElectron && (
                <div className="flex gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateFile(null);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                        title="New Page in Root"
                    >
                        <Plus size={14} className="text-slate-500" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateDir(null);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                        title="New Folder in Root"
                    >
                        <Folder size={14} className="text-slate-500" />
                    </button>
                </div>
            )}
            {children}
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
    onMove,
    wikiTitle,
    onOpenSettings,
    isDesktopSidebarOpen = true
}) => {
    const [contextMenu, setContextMenu] = useState(null);
    const [activeDragId, setActiveDragId] = useState(null);
    const [dragOverInfo, setDragOverInfo] = useState(null); // { overId, position: 'inside' | 'top' | 'bottom' }

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event) => {
        setActiveDragId(event.active.id);
        setDragOverInfo(null);
    };

    const handleDragMove = (event) => {
        const { active, over } = event;

        if (!over) {
            setDragOverInfo(null);
            return;
        }

        if (active.id === over.id) {
            setDragOverInfo(null);
            return;
        }

        // Calculate drop position
        // We need the pointer coordinates relative to the over element.
        // dnd-kit doesn't give pointer coords directly in event, but we can infer from active rect if using closestCenter?
        // Actually, active.rect.current.translated gives the current position of the dragged item.

        const activeRect = active.rect.current.translated;
        const overRect = over.rect; // This is the rect of the drop target

        if (!activeRect || !overRect) return;

        // Use the center of the dragged item to determine position
        const pointerY = activeRect.top + activeRect.height / 2;
        const relativeY = pointerY - overRect.top;
        const ratio = relativeY / overRect.height;

        let position = 'inside';
        const node = over.data.current;

        if (over.id === 'root-drop-zone') {
            position = 'inside';
        } else if (node) {
            if (node.isFolder) {
                // Folder logic: Top 25% -> Top, Bottom 25% -> Bottom, Middle 50% -> Inside
                if (ratio < 0.25) position = 'top';
                else if (ratio > 0.75) position = 'bottom';
                else position = 'inside';
            } else {
                // File logic: Top 50% -> Top, Bottom 50% -> Bottom
                if (ratio < 0.5) position = 'top';
                else position = 'bottom';
            }
        }

        setDragOverInfo({
            overId: over.id,
            position
        });
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveDragId(null);
        setDragOverInfo(null);

        if (!over) return;

        if (active.id !== over.id) {
            // Use the calculated position from dragOverInfo (re-calculate to be safe or use state if reliable)
            // Re-calculating is safer as state might be slightly stale or cleared.

            const activeRect = active.rect.current.translated;
            const overRect = over.rect;

            let position = 'inside';

            if (over.id === 'root-drop-zone') {
                position = 'inside';
            } else if (activeRect && overRect) {
                const pointerY = activeRect.top + activeRect.height / 2;
                const relativeY = pointerY - overRect.top;
                const ratio = relativeY / overRect.height;
                const node = over.data.current;

                if (node) {
                    if (node.isFolder) {
                        if (ratio < 0.25) position = 'top';
                        else if (ratio > 0.75) position = 'bottom';
                        else position = 'inside';
                    } else {
                        if (ratio < 0.5) position = 'top';
                        else position = 'bottom';
                    }
                }
            }

            // Map position to action
            let action = 'inside';
            if (position === 'top') action = 'before';
            if (position === 'bottom') action = 'after';

            // Special case: Root
            if (over.id === 'root-drop-zone') {
                if (onMove) onMove(active.id, 'root', 'inside');
                return;
            }

            if (onMove) {
                onMove(active.id, over.id, action);
            }
        }
    };

    const handleContextMenu = (e, node) => {
        e.preventDefault();
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

    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className={`
            fixed md:relative z-40 h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col flex-shrink-0
            ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} 
            md:translate-x-0 ${isDesktopSidebarOpen ? 'md:w-64' : 'md:w-0 md:overflow-hidden md:border-r-0'}
        `}>
            <div className="min-w-[16rem] h-full flex flex-col">
                <div className="p-5 hidden md:flex items-center justify-between border-b border-transparent">
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-8 h-8" />
                        {wikiTitle}
                    </h1>
                    <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>

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

                <nav className="flex-1 overflow-y-auto px-2 pb-12 custom-scrollbar">
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
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragMove={handleDragMove}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="mt-2">
                                <RootDroppable
                                    isElectron={isElectron()}
                                    onCreateFile={onCreateFile}
                                    onCreateDir={onCreateDir}
                                    dragOverInfo={dragOverInfo}
                                />

                                <SortableContext items={treeData.map(n => n.id)} strategy={verticalListSortingStrategy}>
                                    <div>
                                        {treeData.map((node) => (
                                            <SortableTreeItem
                                                key={node.id}
                                                node={node}
                                                activeNoteId={activeNoteId}
                                                onSelect={(id) => onNavigate(id)}
                                                expandedNodes={expandedNodes}
                                                toggleNode={toggleNode}
                                                onContextMenu={handleContextMenu}
                                                dragOverInfo={dragOverInfo}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </div>

                            {/* Drag Overlay for smooth visuals */}
                            <DragOverlay>
                                {activeDragId ? (
                                    <div className="px-3 py-1.5 bg-white dark:bg-slate-800 shadow-lg rounded-md border border-indigo-200 dark:border-indigo-800 opacity-90">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Moving...</span>
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                </nav>

                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        item={contextMenu.item}
                        onAction={handleAction}
                        onClose={() => setContextMenu(null)}
                    />
                )}

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
        </div>
    );
};

export default Sidebar;
