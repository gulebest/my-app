import { useState } from 'react';
import { Copy } from 'lucide-react';
import cn from 'clsx';

export interface ChatMessageProps {
   role: 'user' | 'assistant';
   content: string;
   codeBlock?: boolean;
   codeLanguage?: string;
   codeTabs?: string[];
   activeTab?: string;
   onTabChange?: (tab: string) => void;
}

export function ChatMessage({
   role,
   content,
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
               'max-w-[88%] rounded-2xl px-3 py-2 text-sm sm:max-w-[78%] sm:px-4',
               role === 'user'
                  ? 'rounded-br-md bg-indigo-500 text-white'
                  : 'rounded-bl-md bg-[var(--app-assistant-bubble)] text-(--app-text-strong)'
            )}
         >
            {content}
         </div>
      </div>
   );
}
