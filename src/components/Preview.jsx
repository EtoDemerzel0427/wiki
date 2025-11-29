import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import {
    Home,
    Calendar,
    Tag,
    Link as LinkIcon
} from 'lucide-react';

const Preview = ({
    content,
    metadata,
    activeNote,
    onNavigate,
    selectedTag,
    onTagClick
}) => {
    // Pre-process content to handle [[WikiLinks]]
    const processContent = (content) => {
        if (!content) return '';
        // Replace [[Title]] with [Title](wiki:Title) - encode the title for the URL
        return content.replace(/\[\[(.*?)\]\]/g, (match, title) => `[${title}](wiki:${encodeURIComponent(title)})`);
    };

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
        li: ({ node, ...props }) => <li className="pl-1 text-slate-700 dark:text-slate-300" {...props} />,
        a: ({ node, href, children, ...props }) => {
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

    const customComponents = {
        ...markdownComponents,
        a: ({ node, href, children, ...props }) => {
            if (href && href.startsWith('wiki:')) {
                const title = href.replace('wiki:', '');
                return (
                    <span
                        onClick={() => onNavigate && onNavigate(title, true)}
                        className="text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline decoration-2 font-medium inline-flex items-center gap-0.5"
                    >
                        <LinkIcon size={12} />{children}
                    </span>
                );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline" {...props}>{children}</a>;
        }
    };

    if (!activeNote) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400">
                Select a page to view or edit
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-10 md:py-16 min-h-full flex flex-col">
            <div className="flex-1">
                {/* Note Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                        <Home size={14} />
                        <span>/</span>
                        <span>{metadata.category || activeNote.category || 'General'}</span>
                        <span>/</span>
                        <span className="text-slate-600 dark:text-slate-300">{metadata.title || activeNote.title}</span>
                    </div>

                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
                        {metadata.title || activeNote.title}
                    </h1>

                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} />
                                {metadata.date || activeNote.date || 'No Date'}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {(metadata.tags
                                ? (typeof metadata.tags === 'string' ? metadata.tags.split(',').map(t => t.trim()).filter(Boolean) : metadata.tags)
                                : activeNote.tags)?.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => onTagClick && onTagClick(tag === selectedTag ? null : tag)}
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
                <div className="prose prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={customComponents}
                        urlTransform={(url) => {
                            if (url.startsWith('wiki:')) return url;
                            return url;
                        }}
                    >
                        {/* Strip frontmatter for display */}
                        {processContent(content ? content.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/, '') : '')}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default Preview;
