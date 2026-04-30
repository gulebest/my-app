import { useState, type ReactNode } from 'react';
import {
   Copy,
   Check,
   ThumbsUp,
   ThumbsDown,
   Share2,
   RotateCcw,
} from 'lucide-react';
import cn from 'clsx';

export interface ChatMessageProps {
   id?: string;
   role: 'user' | 'assistant';
   content: string;
   createdAt?: string | null;
   showTimestamp?: boolean;
   fontSize?: 'small' | 'medium' | 'large';
   bubbleWidth?: number;
   showActions?: boolean;
   canRetry?: boolean;
   onRetry?: () => void;
   codeBlock?: boolean;
   codeLanguage?: string;
   codeTabs?: string[];
   activeTab?: string;
   onTabChange?: (tab: string) => void;
}

export function ChatMessage({
   role,
   content,
   createdAt,
   showTimestamp,
   fontSize = 'medium',
   bubbleWidth = 78,
   showActions = false,
   canRetry = false,
   onRetry,
   codeBlock,
   codeLanguage,
   codeTabs,
   activeTab: propActiveTab,
   onTabChange,
}: ChatMessageProps) {
   const [activeTab, setActiveTab] = useState(
      propActiveTab || codeTabs?.[0] || ''
   );
   const [copied, setCopied] = useState(false);
   const [shared, setShared] = useState(false);
   const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);

   const handleTabChange = (tab: string) => {
      setActiveTab(tab);
      onTabChange?.(tab);
   };

   const handleCopy = async () => {
      try {
         await navigator.clipboard.writeText(content);
         setCopied(true);
         setTimeout(() => setCopied(false), 1200);
      } catch {
         setCopied(false);
      }
   };

   const handleShare = async () => {
      try {
         if (navigator.share) {
            await navigator.share({
               text: content,
            });
         } else {
            await navigator.clipboard.writeText(content);
         }
         setShared(true);
         setTimeout(() => setShared(false), 1200);
      } catch {
         setShared(false);
      }
   };

   if (codeBlock) {
      return (
         <div className="my-4">
            <div className="mb-1 flex items-center gap-2">
               {codeTabs && codeTabs.length > 0 && (
                  <div className="flex gap-1">
                     {codeTabs.map((tab) => (
                        <button
                           key={tab}
                           className={cn(
                              'rounded-t-lg px-3 py-1 text-xs font-medium',
                              activeTab === tab
                                 ? 'bg-[#23244a] text-indigo-400'
                                 : 'bg-[#23244a]/60 text-gray-400 hover:text-indigo-400'
                           )}
                           onClick={() => handleTabChange(tab)}
                        >
                           {tab}
                        </button>
                     ))}
                  </div>
               )}
               <button
                  className="ml-auto flex items-center gap-1 font-mono text-xs text-gray-400 transition hover:text-indigo-400"
                  onClick={handleCopy}
                  title="Copy code"
               >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy code'}
               </button>
            </div>
            <pre className="overflow-x-auto rounded-2xl bg-[#18192b] p-4 text-xs text-gray-100 shadow-inner">
               {codeLanguage ? (
                  <code className="font-mono" data-language={codeLanguage}>
                     {content}
                  </code>
               ) : (
                  <code className="font-mono">{content}</code>
               )}
            </pre>
         </div>
      );
   }

   return (
      <div
         className={cn(
            'my-2 flex flex-col',
            role === 'user' ? 'items-end' : 'items-start'
         )}
      >
         <div
            className={cn(
               'rounded-2xl border px-3 py-2 sm:px-4',
               fontSize === 'small'
                  ? 'text-xs sm:text-sm'
                  : fontSize === 'large'
                    ? 'text-base sm:text-lg'
                    : 'text-sm sm:text-base',
               role === 'user'
                  ? 'rounded-br-md border-[var(--app-user-bubble-border)] bg-[var(--app-user-bubble)] text-[var(--app-user-bubble-text)] shadow-[0_10px_24px_rgba(12,16,34,0.08)]'
                  : 'rounded-bl-md border-[var(--app-assistant-bubble-border)] bg-[var(--app-assistant-bubble)] text-(--app-text-strong)'
            )}
            style={{ maxWidth: `${bubbleWidth}%` }}
         >
            {content}
            {showTimestamp && createdAt && (
               <div
                  className={cn(
                     'mt-1 text-[10px]',
                     role === 'user'
                        ? 'text-[var(--app-user-bubble-timestamp)]'
                        : 'text-(--app-text-muted)'
                  )}
               >
                  {new Date(createdAt).toLocaleTimeString([], {
                     hour: 'numeric',
                     minute: '2-digit',
                  })}
               </div>
            )}
         </div>
         {role === 'assistant' && showActions && content.trim().length > 0 && (
            <div className="mt-2 flex items-center gap-1 px-1 text-(--app-text-muted)">
               <ActionButton
                  label={copied ? 'Copied' : 'Copy response'}
                  active={copied}
                  onClick={() => {
                     void handleCopy();
                  }}
               >
                  {copied ? (
                     <Check className="h-4 w-4" />
                  ) : (
                     <Copy className="h-4 w-4" />
                  )}
               </ActionButton>
               <ActionButton
                  label="Like response"
                  active={reaction === 'like'}
                  onClick={() =>
                     setReaction((current) =>
                        current === 'like' ? null : 'like'
                     )
                  }
               >
                  <ThumbsUp className="h-4 w-4" />
               </ActionButton>
               <ActionButton
                  label="Dislike response"
                  active={reaction === 'dislike'}
                  onClick={() =>
                     setReaction((current) =>
                        current === 'dislike' ? null : 'dislike'
                     )
                  }
               >
                  <ThumbsDown className="h-4 w-4" />
               </ActionButton>
               <ActionButton
                  label={shared ? 'Shared' : 'Share response'}
                  active={shared}
                  onClick={() => {
                     void handleShare();
                  }}
               >
                  <Share2 className="h-4 w-4" />
               </ActionButton>
               {canRetry && onRetry && (
                  <ActionButton label="Retry response" onClick={onRetry}>
                     <RotateCcw className="h-4 w-4" />
                  </ActionButton>
               )}
            </div>
         )}
      </div>
   );
}

interface ActionButtonProps {
   children: ReactNode;
   label: string;
   active?: boolean;
   onClick: () => void;
}

function ActionButton({
   children,
   label,
   active = false,
   onClick,
}: ActionButtonProps) {
   return (
      <button
         type="button"
         className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition hover:bg-[var(--app-soft-surface)]',
            active && 'bg-[var(--app-soft-surface)] text-(--app-text-strong)'
         )}
         onClick={onClick}
         title={label}
         aria-label={label}
      >
         {children}
      </button>
   );
}
