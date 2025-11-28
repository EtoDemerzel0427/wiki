import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  Home
} from 'lucide-react';

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

      return a.title.localeCompare(b.title);
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

// --- 组件：递归树形节点 ---
const TreeNode = ({ node, level = 0, activeNoteId, onSelect, expandedNodes, toggleNode }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.includes(node.id);
  const isActive = activeNoteId === node.id;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 my-0.5 rounded-md cursor-pointer text-sm transition-colors ${isActive && !node.isFolder
          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={() => {
          if (hasChildren || node.isFolder) {
            toggleNode(node.id);
          } else {
            onSelect(node.id);
          }
        }}
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

        <span className="truncate">{node.title}</span>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              activeNoteId={activeNoteId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- 主程序 ---
export default function App() {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper to get base path
  const getBasePath = () => {
    return import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
  };

  // Helper to update URL
  const updateUrl = (noteId) => {
    const basePath = getBasePath();
    const newPath = noteId ? `${basePath}${noteId}` : basePath;
    window.history.pushState({}, '', newPath);
  };

  // Fetch content on mount
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}content.json`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load content');
        return res.json();
      })
      .then(data => {
        setNotes(data);
        setLoading(false);

        // Check URL for note ID (Path based)
        const basePath = getBasePath();
        const path = window.location.pathname;
        let noteIdFromUrl = null;

        if (path.startsWith(basePath)) {
          const relativePath = path.substring(basePath.length);
          if (relativePath && relativePath !== '') {
            noteIdFromUrl = decodeURIComponent(relativePath);
          }
        } else if (path.startsWith('/')) {
          // Handle case where base might be missing or different in dev
          // e.g. /Dev/Frontend/CSSGrid
          const potentialId = path.substring(1);
          if (data.some(n => n.id === potentialId)) {
            noteIdFromUrl = decodeURIComponent(potentialId);
          }
        }

        // Handle redirect from 404.html (query param 'p')
        const params = new URLSearchParams(window.location.search);
        const redirectPath = params.get('p');
        if (redirectPath) {
          noteIdFromUrl = decodeURIComponent(redirectPath);
          // Clean up URL
          updateUrl(noteIdFromUrl);
        }

        let targetNote = null;
        if (noteIdFromUrl) {
          targetNote = data.find(n => n.id === noteIdFromUrl);
        }

        if (!targetNote) {
          // Fallback to default
          targetNote = data.find(n => n.id === 'Meta/About') || data.find(n => !n.isFolder);
        }

        if (targetNote) {
          setActiveNoteId(targetNote.id);
          // Ensure URL is synced if we fell back
          if (targetNote.id !== noteIdFromUrl) {
            updateUrl(targetNote.id);
          }

          // Expand parents
          if (targetNote.parentId) {
            const parents = [];
            let current = targetNote;
            while (current.parentId) {
              parents.push(current.parentId);
              current = data.find(n => n.id === current.parentId) || {};
            }
            setExpandedNodes(prev => [...new Set([...prev, ...parents])]);
          }
        }

        // Expand root folders
        const rootFolders = data.filter(n => !n.parentId && n.isFolder).map(n => n.id);
        setExpandedNodes(prev => [...new Set([...prev, ...rootFolders])]);
      })
      .catch(err => {
        console.error("Failed to load content:", err);
        setLoading(false);
      });
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const basePath = getBasePath();
      const path = window.location.pathname;
      let noteId = null;

      if (path.startsWith(basePath)) {
        const relativePath = path.substring(basePath.length);
        if (relativePath) noteId = decodeURIComponent(relativePath);
      }

      if (noteId && notes.length > 0) {
        const target = notes.find(n => n.id === noteId);
        if (target) setActiveNoteId(target.id);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [notes]);

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
      target = notes.find(n => n.title.toLowerCase() === decodedTitle.toLowerCase());
    } else {
      target = notes.find(n => n.id === identifier);
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
        note.title.toLowerCase().includes(q) ||
        note.content?.toLowerCase().includes(q)
      );

      return matchesTag && matchesSearch;
    });
  }, [searchQuery, selectedTag, notes]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  // Custom components for ReactMarkdown
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <div className="my-6 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#2d2d2d] shadow-sm group">
          <div className="flex justify-between items-center px-4 py-1.5 bg-[#1f1f1f] border-b border-gray-700">
            <span className="text-xs font-mono text-gray-400">{match[1]}</span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
            </div>
          </div>
          <SyntaxHighlighter
            style={tomorrow}
            language={match[1]}
            PreTag="div"
            customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className="bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-sm font-mono mx-1 border border-slate-200 dark:border-slate-700" {...props}>
          {children}
        </code>
      );
    },
    h1: ({ node, ...props }) => <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-8 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800" {...props} />,
    h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-6 mb-3" {...props} />,
    h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-5 mb-2" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 italic rounded-r" {...props} />,
    ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-5 space-y-1 marker:text-indigo-500" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-5 space-y-1 marker:text-indigo-500" {...props} />,
    li: ({ node, ...props }) => <li className="pl-1" {...props} />,
    a: ({ node, href, children, ...props }) => {
      // Handle internal links [[Title]] -> converted to [Title](Title) or similar by remark plugins? 
      // Or just handle standard markdown links. 
      // The user used [[Title]] syntax. react-markdown doesn't support [[WikiLinks]] by default without remark-wiki-link.
      // But the user's parser handled it manually.
      // We can use a regex to pre-process the content or use a plugin.
      // For now, let's assume standard links or implement a simple pre-processor.
      return <a href={href} className="text-indigo-600 dark:text-indigo-400 hover:underline decoration-2 font-medium inline-flex items-center gap-0.5" {...props}><LinkIcon size={12} />{children}</a>
    },
    img: ({ node, ...props }) => (
      <div className="my-6 text-center">
        <img className="rounded-lg shadow-sm max-w-full h-auto mx-auto border border-slate-200 dark:border-slate-800 inline-block" {...props} />
        {props.alt && <p className="text-xs text-slate-500 mt-2">{props.alt}</p>}
      </div>
    ),
    p: ({ node, ...props }) => <p className="mb-4 leading-7 text-slate-700 dark:text-slate-300" {...props} />
  };

  // Pre-process content to handle [[WikiLinks]]
  const processContent = (content) => {
    if (!content) return '';
    // Replace [[Title]] with [Title](wiki:Title) - encode the title for the URL
    return content.replace(/\[\[(.*?)\]\]/g, (match, title) => `[${title}](wiki:${encodeURIComponent(title)})`);
  };

  const customComponents = {
    ...markdownComponents,
    a: ({ node, href, children, ...props }) => {
      if (href && href.startsWith('wiki:')) {
        const title = href.replace('wiki:', '');
        return (
          <span
            onClick={() => handleNavigate(title, true)}
            className="text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline decoration-2 font-medium inline-flex items-center gap-0.5"
          >
            <LinkIcon size={12} />{children}
          </span>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline" {...props}>{children}</a>;
    }
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Loading wiki...</div>;
  }

  return (
    <div className={`h-screen w-full flex flex-col md:flex-row bg-white dark:bg-slate-950 transition-colors duration-200 overflow-hidden ${darkMode ? 'dark' : ''}`}>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 z-20">
        <span className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-6 h-6" /> Wiki
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
      <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-10 w-64 h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 flex flex-col flex-shrink-0`}>
        <div className="p-5 hidden md:flex items-center justify-between border-b border-transparent">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-8 h-8" />
            Wiki
          </h1>
          <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

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
                    onClick={() => handleNavigate(note.id)}
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
              <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Explorer</div>
              {treeData.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  activeNoteId={activeNoteId}
                  onSelect={(id) => handleNavigate(id)}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                />
              ))}
            </div>
          )}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-full bg-white dark:bg-slate-950 flex flex-col relative overflow-hidden">
        {activeNote ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto px-6 md:px-12 py-10 md:py-16 min-h-full flex flex-col">

              <div className="flex-1">
                {/* Note Header */}
                <div className="mb-10">
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                    <Home size={14} />
                    <span>/</span>
                    <span>{activeNote.category}</span>
                    <span>/</span>
                    <span className="text-slate-600 dark:text-slate-300">{activeNote.title}</span>
                  </div>

                  <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
                    {activeNote.title}
                  </h1>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {activeNote.date}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {activeNote.tags?.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                          className={`px-2.5 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${selectedTag === tag
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                          <Tag size={10} />
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Note Body */}
                <div className="min-h-[200px]">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={customComponents}
                    urlTransform={(url) => {
                      if (url.startsWith('wiki:')) return url;
                      return url;
                    }}
                  >
                    {processContent(activeNote.content)}
                  </ReactMarkdown>
                </div>
              </div>

              <div className="mt-24 pt-8 border-t border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
                  <Github size={14} />
                  <span className="hover:underline cursor-pointer">Edit this page on GitHub</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 bg-slate-50/30 dark:bg-slate-900/30">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <BookOpen size={32} className="text-slate-400" />
            </div>
            <p className="text-lg font-medium opacity-60">Select a file to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
