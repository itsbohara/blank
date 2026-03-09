"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlock({ inline, className, children, ...props }: any) {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeContent = children ? String(children).replace(/\n$/, "") : "";

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-muted-foreground/20 font-mono text-xs" {...props}>
        {codeContent}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border/50">
      {language && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 text-xs">
          <span className="font-medium text-muted-foreground lowercase">{language}</span>
          <TooltipIconButton tooltip={isCopied ? "Copied!" : "Copy"} onClick={handleCopy}>
            {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </TooltipIconButton>
        </div>
      )}
      <pre className={cn("p-3 overflow-x-auto text-xs leading-relaxed bg-muted/30", !language && "rounded-t-lg")}>
        <code className="font-mono" {...props}>{codeContent}</code>
      </pre>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MarkdownComponents: any = {
  code: CodeBlock,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h1: ({ children, ...props }: any) => <h1 className="text-lg font-semibold mt-4 mb-2" {...props}>{children}</h1>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h2: ({ children, ...props }: any) => <h2 className="text-base font-semibold mt-3 mb-2" {...props}>{children}</h2>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h3: ({ children, ...props }: any) => <h3 className="text-sm font-semibold mt-2 mb-1" {...props}>{children}</h3>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p: ({ children, ...props }: any) => <p className="mb-2 leading-relaxed" {...props}>{children}</p>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ul: ({ children, ...props }: any) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props}>{children}</ul>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ol: ({ children, ...props }: any) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props}>{children}</ol>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  li: ({ children, ...props }: any) => <li className="leading-relaxed" {...props}>{children}</li>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground my-2" {...props}>
      {children}
    </blockquote>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse my-2 text-xs" {...props}>{children}</table>
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thead: ({ children, ...props }: any) => <thead className="bg-muted" {...props}>{children}</thead>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  th: ({ children, ...props }: any) => (
    <th className="border border-border px-3 py-2 text-left font-medium" {...props}>{children}</th>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  td: ({ children, ...props }: any) => <td className="border border-border px-3 py-2" {...props}>{children}</td>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tbody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
  hr: () => <hr className="my-3 border-border" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: ({ children, href, ...props }: any) => (
    <a 
      href={href} 
      className="text-primary hover:underline inline-flex items-center gap-0.5" 
      target="_blank" 
      rel="noopener noreferrer" 
      {...props}
    >
      {children}
      <svg className="w-3 h-3 ml-0.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15,3 21,3 21,9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strong: ({ children, ...props }: any) => <strong className="font-semibold" {...props}>{children}</strong>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  em: ({ children, ...props }: any) => <em className="italic" {...props}>{children}</em>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  del: ({ children, ...props }: any) => <del className="line-through" {...props}>{children}</del>,
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
