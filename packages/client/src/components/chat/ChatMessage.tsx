import { useState } from 'react';
import { Copy } from 'lucide-react';
import cn from 'clsx';

export interface ChatMessageProps {
   id?: string;
   role: 'user' | 'assistant';
   content: string;
   createdAt?: string | null;
   showTimestamp?: boolean;
   fontSize?: 'small' | 'medium' | 'large';
   bubbleWidth?: number;
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
            'my-2 flex',
            role === 'user' ? 'justify-end' : 'justify-start'
         )}
      >
         <div
            className={cn(
               'rounded-2xl border px-3 py-2 shadow-[0_10px_24px_rgba(12,16,34,0.08)] sm:px-4',
               fontSize === 'small'
                  ? 'text-xs sm:text-sm'
                  : fontSize === 'large'
                    ? 'text-base sm:text-lg'
                    : 'text-sm sm:text-base',
               role === 'user'
                  ? 'rounded-br-md border-[var(--app-user-bubble-border)] bg-[var(--app-user-bubble)] text-[var(--app-user-bubble-text)]'
                  : 'rounded-bl-md border-transparent bg-[var(--app-assistant-bubble)] text-(--app-text-strong)'
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
      </div>
   );
}
