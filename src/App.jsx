import React, { useState, useMemo, useEffect } from 'react';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS

import {
  Search,
  Menu,
  Folder,
  FolderOpen,
  Calendar,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Moon,
  Sun,
  Github,
  Link as LinkIcon,
  Tag,
  FileText,
  X,
  Home,
  Edit,
  Save,
  Eye,
  Type,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import Editor from './components/Editor';
import Preview from './components/Preview';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import { isElectron, readFile, writeFile } from './utils/fileSystem';
import { parseFrontmatter, stringifyFrontmatter } from './utils/frontmatter';
import { useFileSystem } from './hooks/useFileSystem';

// --- 工具函数：构建树形结构 ---
const buildTree = (items) => {
  const rootItems = [];
  const lookup = {};

  // Initialize lookup
  items.forEach(item => {
    lookup[item.id] = { ...item, children: [] };
  });

  // Build tree
  items.forEach(item => {
    if (item.parentId && lookup[item.parentId]) {
      lookup[item.parentId].children.push(lookup[item.id]);
    } else {
      // If parent doesn't exist (or is null), add to root
      rootItems.push(lookup[item.id]);
    }
  });

  // Sort children
  const sortNodes = (nodes) => {
    return nodes.sort((a, b) => {
      // 1. Sort by sortIndex
      if (a.sortIndex !== undefined && b.sortIndex !== undefined) {
        if (a.sortIndex !== b.sortIndex) {
          return a.sortIndex - b.sortIndex;
        }
      }

      // 2. Fallback: Folders first, then alphabetical
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }

      const titleA = a.title || a.id || '';
      const titleB = b.title || b.id || '';
      return titleA.localeCompare(titleB);
    });
  };

  // Sort root items
  sortNodes(rootItems);

  // Sort children of all items
  Object.values(lookup).forEach(node => {
    if (node.children.length > 0) {
      sortNodes(node.children);
    }
  });

  return rootItems;
};



// --- 主程序 ---
export default function App() {
  const {
    notes,
    loading,
    setNotes,
    loadNotes,
    handleCreateFile,
    handleCreateDir,
    handleDelete,
    handleRename: fsHandleRename,
    handleReorder,
    handleMove,
    wikiConfig,
    saveConfig
  } = useFileSystem();

  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  // const [loading, setLoading] = useState(true); // Handled by hook
  const [isEditMode, setIsEditMode] = useState(false);
  const [fileContent, setFileContent] = useState(''); // Store fresh content from disk
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);

  // Split View State
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Auto-Save Effect
  useEffect(() => {
    if (!isElectron()) return;

    // Check initial status
    window.electronAPI.getAutoSaveStatus().then(setIsAutoSaveEnabled);

    // Listen for changes
    const unsubscribe = window.electronAPI.onAutoSaveChange((enabled) => {
      setIsAutoSaveEnabled(enabled);
    });

    return () => {
      // Cleanup if needed (though onAutoSaveChange returns void currently, 
      // we might want to implement removeListener in preload if strict cleanup is needed.
      // For now, this is fine as App is root.)
    };
  }, []);

  // Debounced Auto-Save
  useEffect(() => {
    if (!isAutoSaveEnabled || !activeNoteId || !isEditMode) return;

    const timer = setTimeout(() => {
      handleSaveContent(fileContent);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [fileContent, isAutoSaveEnabled, activeNoteId, isEditMode]);

  // Split View Drag Handlers
  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };

  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMouseMove = (e) => {
      // Calculate new ratio based on mouse X position relative to window width
      // We need to account for the sidebar width if it's open
      // But simpler: just use percentage of the main content area?
      // Actually, the mouse event is global.
      // Let's assume the main content area starts after the sidebar.
      // But the sidebar width is dynamic.
      // A robust way:
      // The main content div is the parent. We can get its bounding rect?
      // But we don't have a ref to it easily here without adding one.
      // Let's try a simpler approach: 
      // The split is within the main content area.
      // If sidebar is 256px (w-64), then content starts at 256px.
      // Ratio = (MouseX - SidebarWidth) / ContentWidth

      const sidebarWidth = document.querySelector('.md\\:w-64')?.offsetWidth || 0;
      const contentWidth = window.innerWidth - sidebarWidth;
      let newRatio = (e.clientX - sidebarWidth) / contentWidth;

      // Clamp ratio
      if (newRatio < 0.2) newRatio = 0.2;
      if (newRatio > 0.8) newRatio = 0.8;

      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit]);

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: null, // 'createFile', 'createDir', 'rename', 'delete'
    title: '',
    value: '',
    item: null, // For rename/delete/create context
    parentId: null // Explicit parentId for creation
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsFontTheme, setSettingsFontTheme] = useState('');
  const [settingsFontSize, setSettingsFontSize] = useState('base');

  // Page Appearance State
  const [isPageAppearanceOpen, setIsPageAppearanceOpen] = useState(false);
  const [pageFontTheme, setPageFontTheme] = useState('');
  const [pageFontSize, setPageFontSize] = useState('');

  useEffect(() => {
    if (wikiConfig) {
      setSettingsTitle(wikiConfig.title || '');
      setSettingsFontTheme(wikiConfig.fontTheme || '');
      setSettingsFontSize(wikiConfig.fontSize || 'base');
      // Update document title
      if (wikiConfig.title) document.title = wikiConfig.title;
    }
  }, [wikiConfig]);

  // Content Path State (Electron only)
  const [contentPath, setContentPath] = useState('');

  useEffect(() => {
    if (isElectron() && window.electronAPI?.getSettings) {
      window.electronAPI.getSettings().then(settings => {
        if (settings.contentPath) {
          setContentPath(settings.contentPath);
        }
      });
    }
  }, []);

  const handleContentPathChange = async () => {
    if (!isElectron() || !window.electronAPI?.selectContentFolder) return;

    const path = await window.electronAPI.selectContentFolder();
    if (path) {
      setContentPath(path);
      // We'll save this when the user clicks "Save" in the modal, 
      // OR we could save immediately. Saving in modal confirm is better UX.
      // But for simplicity and to ensure restart logic is clear, let's store it in a temp state?
      // Actually, let's just update the state here and save in onConfirm.
    }
  };

  // State for View Mode Metadata
  const [viewMetadata, setViewMetadata] = useState({});
  const [viewBody, setViewBody] = useState('');

  useEffect(() => {
    const { metadata, body } = parseFrontmatter(fileContent);
    setViewMetadata(metadata);
    setViewBody(body);
  }, [fileContent]);

  const openModal = (type, item = null) => {
    let title = '';
    let value = '';
    let parentId = null;

    // Determine parentId based on context
    if (type === 'createFile' || type === 'createDir') {
      if (item) {
        // Context menu on an item
        parentId = item.isFolder ? item.id : item.parentId;
      }
      // If no item provided (e.g. from Sidebar header buttons), default to root (parentId = null)
      // We explicitly removed the fallback to activeNoteId here as per user request.
    }

    switch (type) {
      case 'createFile':
        title = parentId ? `Create New Page in ${parentId}` : 'Create New Page';
        break;
      case 'createDir':
        title = parentId ? `Create New Folder in ${parentId}` : 'Create New Folder';
        break;
      case 'rename':
        title = 'Rename Item';
        value = item.title;
        break;
      case 'delete':
        title = 'Delete Item';
        break;
    }

    setModalConfig({
      isOpen: true,
      type,
      title,
      value,
      item,
      parentId
    });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleModalConfirm = async () => {
    const { type, value, item, parentId } = modalConfig;

    try {
      if (type === 'createFile') {
        await handleCreateFile(value, parentId);
      } else if (type === 'createDir') {
        await handleCreateDir(value, parentId);
      } else if (type === 'rename') {
        const newId = await fsHandleRename(item, value);
        if (newId && activeNoteId === item.id) {
          setActiveNoteId(newId);
        }
      } else if (type === 'delete') {
        await handleDelete(item);
      }
      closeModal();
    } catch (error) {
      console.error("Operation failed:", error);
      // Could show error in modal or toast
      alert("Operation failed: " + error.message);
    }
  };

  // Helper to update URL
  const updateUrl = (identifier) => {
    const note = notes.find(n => n.id === identifier || n.slug === identifier);
    const pathSegment = note?.slug || identifier;

    if (pathSegment) {
      window.location.hash = pathSegment;
    } else {
      // Clear hash if going to root/default? Or keep current behavior
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  };


  useEffect(() => {
    if (loading || notes.length === 0) return;

    // Check URL for note ID (Hash based)
    const hash = window.location.hash.substring(1); // Remove '#'
    let noteIdFromUrl = null;

    if (hash) {
      noteIdFromUrl = decodeURIComponent(hash);
    }

    // Handle redirect from 404.html (query param 'p') - keep for backward compat if needed
    const params = new URLSearchParams(window.location.search);
    const redirectPath = params.get('p');
    if (redirectPath) {
      noteIdFromUrl = decodeURIComponent(redirectPath);
      // Convert to hash
      window.location.hash = noteIdFromUrl;
    }

    let targetNote = null;
    if (noteIdFromUrl) {
      targetNote = notes.find(n => n.id === noteIdFromUrl || n.slug === noteIdFromUrl);
    }

    if (!targetNote) {
      targetNote = notes.find(n => n.id === 'Meta/About') || notes.find(n => !n.isFolder);
    }

    if (targetNote) {
      setActiveNoteId(targetNote.id);
      // Ensure hash matches
      if (targetNote.slug && hash !== targetNote.slug) {
        window.history.replaceState(null, null, `#${targetNote.slug}`);
      }

      // Expand parents
      if (targetNote.parentId) {
        const parents = [];
        let current = targetNote;
        while (current.parentId) {
          parents.push(current.parentId);
          current = notes.find(n => n.id === current.parentId) || {};
        }
        setExpandedNodes(prev => [...new Set([...prev, ...parents])]);
      }
    } else if (noteIdFromUrl) {
      // If a path was in the URL but no matching note found
      setActiveNoteId(noteIdFromUrl);
    }

    // Expand root folders
    const rootFolders = notes.filter(n => !n.parentId && n.isFolder).map(n => n.id);
    setExpandedNodes(prev => [...new Set([...prev, ...rootFolders])]);
  }, [loading, notes]); // Removed location.pathname dependency as we use hash now

  // Handle hash change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        const noteId = decodeURIComponent(hash);
        const target = notes.find(n => n.id === noteId || n.slug === noteId);
        if (target) setActiveNoteId(target.id);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [notes]);

  // Load content when activeNoteId changes
  useEffect(() => {
    const loadContent = async () => {
      if (!activeNoteId) {
        setFileContent(''); // Clear content if no active note
        return;
      }

      if (isElectron()) {
        try {
          const note = notes.find(n => n.id === activeNoteId);
          let relativePath;

          if (note && note.filePath) {
            // generate-content.js: filePath = content/file (e.g. "content/Physics/Quantum.md")
            relativePath = note.filePath;
          } else {
            // Fallback if filePath is not available (e.g., new file not yet processed by generator)
            relativePath = `content/${activeNoteId}.md`;
          }

          const content = await readFile(relativePath);
          setFileContent(content);
        } catch (error) {
          console.error("Failed to load file content:", error);
          // Fallback to what's in notes array if read fails?
          const note = notes.find(n => n.id === activeNoteId);
          if (note) setFileContent(note.content);
        }
      } else if (activeNoteId) {
        // Browser mode: use the content from content.json
        const note = notes.find(n => n.id === activeNoteId);
        if (note) setFileContent(note.content);
      }
    };
    loadContent();
  }, [activeNoteId, notes]);

  // Reset edit mode when navigating to a new note
  useEffect(() => {
    setIsEditMode(false);
  }, [activeNoteId]);

  const handleSaveContent = async (newContent) => {
    if (!activeNoteId) return;
    const note = notes.find(n => n.id === activeNoteId);

    try {
      // 1. Write to file (Electron only)
      if (isElectron()) {
        let relativePath;
        if (note && note.filePath) {
          relativePath = note.filePath;
        } else {
          relativePath = `content/${activeNoteId}.md`;
        }
        await writeFile(relativePath, newContent);
      } else {
        // Browser mode save (no-op or local storage if implemented)
      }

      setFileContent(newContent);

      // 2. Parse metadata to update title/tags in the sidebar immediately (Optimistic)
      const { metadata } = parseFrontmatter(newContent);

      setNotes(prev => prev.map(n => {
        if (n.id === activeNoteId) {
          return {
            ...n,
            content: newContent,
            title: metadata.title || n.title,
            slug: metadata.slug || n.slug, // Update slug
            tags: metadata.tags || n.tags,
            category: metadata.category || n.category,
            date: metadata.date || n.date
          };
        }
        return n;
      }));

      // Update URL if slug changed
      if (metadata.slug && metadata.slug !== note?.slug) {
        updateUrl(metadata.slug);
      }

      // 3. Regenerate and Reload (Electron only)
      if (isElectron() && window.electronAPI?.runGenerator) {
        await window.electronAPI.runGenerator();
        // Reload notes to ensure full consistency (e.g. if category changed and folder structure needs update)
        await loadNotes(true);
      }

      // Optional: Show success notification
    } catch (error) {
      console.error("Failed to save file:", error);
      alert("Failed to save file: " + error.message);
    }
  };



  // Toggle Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 构建树
  const treeData = useMemo(() => buildTree(notes), [notes]);

  // 导航处理
  const handleNavigate = (identifier, isTitle = false) => {
    let target;
    if (isTitle) {
      // Decode URI component just in case
      const decodedTitle = decodeURIComponent(identifier);
      target = notes.find(n => (n.title || '').toLowerCase() === decodedTitle.toLowerCase());
    } else {
      // Try to find by ID or Slug
      target = notes.find(n => n.id === identifier || n.slug === identifier);
    }

    if (target) {
      setActiveNoteId(target.id);
      updateUrl(target.id);
      setIsMobileMenuOpen(false);
    } else {
      console.warn(`Page "${identifier}" not found!`);
    }
  };

  const toggleNode = (id) => {
    setExpandedNodes(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    );
  };

  // 过滤逻辑
  const flatFilteredNotes = useMemo(() => {
    if (!searchQuery && !selectedTag) return null;

    return notes.filter(note => {
      if (note.isFolder) return false;

      const q = searchQuery.toLowerCase();
      const matchesTag = selectedTag ? note.tags?.includes(selectedTag) : true;
      const matchesSearch = !q || (
        (note.title || '').toLowerCase().includes(q) ||
        (note.content || '').toLowerCase().includes(q)
      );

      return matchesTag && matchesSearch;
    });
  }, [searchQuery, selectedTag, notes]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Loading wiki...</div>;
  }

  const effectiveFontSize = viewMetadata.fontSize || wikiConfig?.fontSize || 'base';

  return (
    <div className={`h-screen w-full flex flex-col md:flex-row bg-white dark:bg-slate-950 transition-colors duration-200 overflow-hidden ${darkMode ? 'dark' : ''}`}>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-20">
        <span className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-6 h-6" /> {wikiConfig?.title || "RectoWiki"}
        </span>
        <div className="flex gap-2">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-600 dark:text-slate-400">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600 dark:text-slate-400">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        treeData={treeData}
        activeNoteId={activeNoteId}
        onNavigate={(id) => handleNavigate(id)}
        expandedNodes={expandedNodes}
        toggleNode={toggleNode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        isMobileMenuOpen={isMobileMenuOpen}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        flatFilteredNotes={flatFilteredNotes}
        onCreateFile={(item) => openModal('createFile', item)}
        onCreateDir={(item) => openModal('createDir', item)}
        onDelete={(item) => openModal('delete', item)}
        onRename={(item) => openModal('rename', item)}
        onReorder={handleReorder}
        onMove={handleMove}
        wikiTitle={wikiConfig?.title || "RectoWiki"}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDesktopSidebarOpen={isDesktopSidebarOpen}
      />

      {/* Main Content Area */}
      <div className={`flex-1 h-full bg-white dark:bg-slate-950 flex flex-col relative overflow-hidden ${viewMetadata.fontTheme || wikiConfig.fontTheme || ''}`}>

        {/* Desktop Sidebar Toggle */}
        <button
          onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
          className="hidden md:flex absolute top-4 left-4 z-10 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm border border-slate-200 dark:border-slate-700 rounded-md text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          title={isDesktopSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isDesktopSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
        {activeNote ? (
          <>
            {isEditMode && isElectron() ? (
              <div className="flex-1 flex h-full overflow-hidden">
                <div
                  className="h-full border-r border-slate-200 dark:border-slate-800 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900"
                  style={{ width: `${splitRatio * 100}%` }}
                >
                  <Preview
                    content={fileContent}
                    metadata={viewMetadata}
                    activeNote={activeNote}
                    onNavigate={handleNavigate}
                    selectedTag={selectedTag}
                    onTagClick={setSelectedTag}
                    fontSize={effectiveFontSize}
                  />
                </div>

                {/* Draggable Divider */}
                <div
                  className="w-1 h-full cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-10 flex-shrink-0"
                  onMouseDown={handleSplitMouseDown}
                />

                <div className="flex-1 h-full overflow-hidden">
                  <Editor
                    content={fileContent}
                    filePath={
                      activeNote.parentId
                        ? `content/${activeNote.parentId}/${activeNote.fileName}`
                        : `content/${activeNote.fileName}`
                    }
                    onSave={handleSaveContent}
                    onChange={(newContent) => {
                      setFileContent(newContent);
                      const { metadata, body } = parseFrontmatter(newContent);
                      setViewMetadata(metadata);
                      setViewBody(body);
                    }}
                    fontSize={effectiveFontSize}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isEditMode ? (
                  <Editor
                    content={fileContent}
                    filePath={
                      activeNote.parentId
                        ? `content/${activeNote.parentId}/${activeNote.fileName}`
                        : `content/${activeNote.fileName}`
                    }
                    onSave={handleSaveContent}
                    onChange={(newContent) => {
                      setFileContent(newContent);
                      const { metadata, body } = parseFrontmatter(newContent);
                      setViewMetadata(metadata);
                      setViewBody(body);
                    }}
                    fontSize={effectiveFontSize}
                  />
                ) : (
                  <Preview
                    content={fileContent}
                    metadata={viewMetadata}
                    activeNote={activeNote}
                    onNavigate={handleNavigate}
                    selectedTag={selectedTag}
                    onTagClick={setSelectedTag}
                    fontSize={effectiveFontSize}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Select a page to view or edit
          </div>
        )}

        {/* Edit Toggle Button - Electron Only */}
        {
          activeNote && isElectron() && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className="absolute top-6 right-8 p-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors z-10"
              title={isEditMode ? "View Mode" : "Edit Mode"}
            >
              {isEditMode ? <Eye size={20} /> : <Edit size={20} />}
            </button>
          )
        }

        {/* Page Appearance Button - Electron Only */}
        {
          activeNote && isElectron() && (
            <button
              onClick={() => {
                setPageFontTheme(viewMetadata.fontTheme || '');
                setPageFontSize(viewMetadata.fontSize || '');
                setIsPageAppearanceOpen(true);
              }}
              className="absolute top-6 right-20 p-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors z-10"
              title="Page Appearance"
            >
              <Type size={20} />
            </button>
          )
        }
      </div >

      {/* Page Appearance Modal */}
      <Modal
        isOpen={isPageAppearanceOpen}
        onClose={() => setIsPageAppearanceOpen(false)}
        title="Page Appearance"
        onConfirm={async () => {
          // Update frontmatter
          const { metadata, body } = parseFrontmatter(fileContent);
          const newMetadata = { ...metadata, fontTheme: pageFontTheme, fontSize: pageFontSize };

          // Remove if empty to fallback to global
          if (!pageFontTheme) delete newMetadata.fontTheme;
          if (!pageFontSize) delete newMetadata.fontSize;

          // Reconstruct file content
          const newContent = stringifyFrontmatter(newMetadata, body);

          await handleSaveContent(newContent);
          setIsPageAppearanceOpen(false);
        }}
        confirmText="Save"
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Font Theme (This Page Only)
          </label>
          <select
            value={pageFontTheme}
            onChange={(e) => setPageFontTheme(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Use Global Default</option>
            <option value="theme-serif">Elegant Serif</option>
            <option value="theme-academic">Academic</option>
            <option value="theme-system">System Native</option>
            <option value="theme-ink">Chinese Ink (楷体)</option>
            <option value="theme-song">Chinese Song (宋体)</option>
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Overrides the global font setting for this specific page.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Content Size (This Page Only)
          </label>
          <select
            value={pageFontSize}
            onChange={(e) => setPageFontSize(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Use Global Default</option>
            <option value="sm">Small</option>
            <option value="base">Normal</option>
            <option value="lg">Large</option>
            <option value="xl">Extra Large</option>
          </select>
        </div>
      </Modal>

      {/* Modal */}
      < Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        onConfirm={handleModalConfirm}
        confirmText={modalConfig.type === 'delete' ? 'Delete' : 'Confirm'}
        isDestructive={modalConfig.type === 'delete'}
      >
        {
          modalConfig.type === 'delete' ? (
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <span className="font-semibold">{modalConfig.item?.title}</span>? This action cannot be undone.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Name
              </label>
              <input
                type="text"
                value={modalConfig.value}
                onChange={(e) => setModalConfig(prev => ({ ...prev, value: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleModalConfirm();
                }}
              />
            </div>
          )
        }
      </Modal >

      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
        onConfirm={async () => {
          await saveConfig({
            title: settingsTitle,
            fontTheme: settingsFontTheme,
            fontSize: settingsFontSize
          });

          if (isElectron() && window.electronAPI?.saveSettings) {
            await window.electronAPI.saveSettings({ contentPath });
            // Reload to apply changes
            window.location.reload();
          }

          setIsSettingsOpen(false);
        }}
        confirmText="Save"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Wiki Title
            </label>
            <input
              type="text"
              value={settingsTitle}
              onChange={(e) => setSettingsTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter wiki title..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Font Theme
            </label>
            <select
              value={settingsFontTheme}
              onChange={(e) => setSettingsFontTheme(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Modern Sans (Default)</option>
              <option value="theme-serif">Elegant Serif</option>
              <option value="theme-academic">Academic</option>
              <option value="theme-system">System Native</option>
              <option value="theme-ink">Chinese Ink (楷体)</option>
              <option value="theme-song">Chinese Song (宋体)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Content Size
            </label>
            <select
              value={settingsFontSize}
              onChange={(e) => setSettingsFontSize(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="sm">Small</option>
              <option value="base">Normal</option>
              <option value="lg">Large</option>
              <option value="xl">Extra Large</option>
            </select>
          </div>

          {isElectron() && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Content Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contentPath || 'Default (App Resource)'}
                  readOnly
                  className={`flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 focus:outline-none cursor-not-allowed ${!contentPath ? 'italic' : ''}`}
                />
                <button
                  onClick={handleContentPathChange}
                  disabled={!contentPath && false} // Always allow browsing
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Browse...
                </button>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="useDefaultPath"
                  checked={!contentPath}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setContentPath('');
                    }
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="useDefaultPath" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  Use default location (App Resources)
                </label>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Select a folder containing your markdown content. The app will restart after changing this setting.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div >
  );
}
