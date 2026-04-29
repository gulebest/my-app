import { Paperclip, Smile, Send } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

interface ChatInputBarProps {
   onSend: (message: string) => Promise<void> | void;
   disabled?: boolean;
}

const EMOJIS = [
   '\u{1F600}',
   '\u{1F602}',
   '\u{1F60D}',
   '\u{1F60E}',
   '\u{1F44D}',
   '\u{1F64F}',
   '\u{1F389}',
   '\u{1F525}',
   '\u{1F916}',
   '\u{1F605}',
   '\u{1F622}',
   '\u{1F621}',
   '\u{1F631}',
   '\u{1F973}',
   '\u{1F4A1}',
   '\u{1F680}',
];

export function ChatInputBar({ onSend, disabled = false }: ChatInputBarProps) {
   const [value, setValue] = useState('');
   const [showEmoji, setShowEmoji] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const handleFileClick = () => {
      fileInputRef.current?.click();
   };

   const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         alert(`File selected: ${file.name}`);
      }
   };

   const handleEmojiClick = () => {
      setShowEmoji((open) => !open);
   };

   const handleEmojiSelect = (emoji: string) => {
      setValue((current) => current + emoji);
      setShowEmoji(false);
   };

   return (
      <form
         className="relative mt-3 flex items-center gap-1 rounded-2xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-2 py-2 shadow-[0_10px_24px_rgba(10,12,30,0.35)] sm:mt-4 sm:gap-3 sm:px-4 sm:py-3"
         onSubmit={async (e) => {
            e.preventDefault();
            const message = value.trim();
            if (message && !disabled) {
               await onSend(message);
               setValue('');
            }
         }}
      >
         <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
         />
         <button
            type="button"
            className="rounded-lg p-2 transition hover:bg-[#18192b]"
            onClick={handleFileClick}
            title="Attach file"
            disabled={disabled}
         >
            <Paperclip className="h-5 w-5 text-(--app-text-muted)" />
         </button>
         <input
            className="flex-1 bg-transparent px-1 text-sm text-(--app-text-strong) outline-none placeholder:text-(--app-text-muted) sm:px-2 sm:text-base"
            placeholder="Start typing"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
         />
         <button
            type="button"
            className="rounded-lg p-2 transition hover:bg-[#18192b]"
            onClick={handleEmojiClick}
            title="Insert emoji"
            disabled={disabled}
         >
            <Smile className="h-5 w-5 text-(--app-text-muted)" />
         </button>
         {showEmoji && (
            <div className="absolute bottom-16 right-0 z-30 flex w-56 flex-wrap gap-2 rounded-xl bg-[#23244a] p-3 shadow-lg">
               {EMOJIS.map((emoji) => (
                  <button
                     key={emoji}
                     className="text-2xl transition hover:scale-110"
                     type="button"
                     onClick={() => handleEmojiSelect(emoji)}
                  >
                     {emoji}
                  </button>
               ))}
            </div>
         )}
         <button
            type="submit"
            className="flex items-center gap-1 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 sm:px-4"
            disabled={disabled}
         >
            <span className="hidden sm:inline">
               {disabled ? 'Sending...' : 'Send'}
            </span>
            <Send className="ml-1 h-5 w-5" />
         </button>
      </form>
   );
}
