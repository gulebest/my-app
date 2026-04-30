import { Paperclip, Smile, Send } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';

interface ChatInputBarProps {
   onSend: (message: string) => Promise<void> | void;
   disabled?: boolean;
   enterToSend?: boolean;
   initialValue?: string;
}

const EMOJIS = [
   '\u{1F600}',
   '\u{1F602}',
   '\u{1F60D}',
   '\u{1F60E}',
   '\u{1F642}',
   '\u{1F643}',
   '\u{1F609}',
   '\u{1F60A}',
   '\u{1F618}',
   '\u{1F970}',
   '\u{1F60B}',
   '\u{1F61C}',
   '\u{1F92D}',
   '\u{1F929}',
   '\u{1F60F}',
   '\u{1F914}',
   '\u{1F928}',
   '\u{1F610}',
   '\u{1F644}',
   '\u{1F62E}',
   '\u{1F62F}',
   '\u{1F44D}',
   '\u{1F44E}',
   '\u{1F44F}',
   '\u{1F64C}',
   '\u{1F64F}',
   '\u{1F91D}',
   '\u{1F44B}',
   '\u{1F64B}',
   '\u{1F4AA}',
   '\u{1F90D}',
   '\u{2764}\u{FE0F}',
   '\u{1F494}',
   '\u{1F495}',
   '\u{1F496}',
   '\u{1F389}',
   '\u{1F381}',
   '\u{1F38A}',
   '\u{1F38F}',
   '\u{1F3C6}',
   '\u{1F525}',
   '\u{1F916}',
   '\u{1F605}',
   '\u{1F622}',
   '\u{1F97A}',
   '\u{1F621}',
   '\u{1F92C}',
   '\u{1F631}',
   '\u{1F973}',
   '\u{1F4A1}',
   '\u{1F31F}',
   '\u{2B50}',
   '\u{1F308}',
   '\u{2600}\u{FE0F}',
   '\u{1F319}',
   '\u{26A1}',
   '\u{2744}\u{FE0F}',
   '\u{1F4AF}',
   '\u{1F44C}',
   '\u{2705}',
   '\u{274C}',
   '\u{2757}',
   '\u{2753}',
   '\u{1F91F}',
   '\u{1F3AF}',
   '\u{1F3B5}',
   '\u{1F3A7}',
   '\u{1F4DA}',
   '\u{1F4BB}',
   '\u{1F680}',
   '\u{1F6A8}',
   '\u{1F4A5}',
   '\u{1F47B}',
   '\u{1F47D}',
   '\u{1F480}',
];

export function ChatInputBar({
   onSend,
   disabled = false,
   enterToSend = true,
   initialValue = '',
}: ChatInputBarProps) {
   const [value, setValue] = useState(initialValue);
   const [showEmoji, setShowEmoji] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const emojiPickerRef = useRef<HTMLDivElement | null>(null);

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

   useEffect(() => {
      const handlePointerDown = (event: MouseEvent) => {
         const target = event.target;
         if (!(target instanceof Node)) {
            return;
         }

         if (showEmoji && !emojiPickerRef.current?.contains(target)) {
            setShowEmoji(false);
         }
      };

      document.addEventListener('mousedown', handlePointerDown);

      return () => {
         document.removeEventListener('mousedown', handlePointerDown);
      };
   }, [showEmoji]);

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
         <textarea
            className="max-h-32 min-h-[32px] flex-1 resize-none bg-transparent px-1 py-1 text-sm text-(--app-text-strong) outline-none placeholder:text-(--app-text-muted) sm:px-2 sm:text-base"
            placeholder="Start typing"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
               if (!enterToSend) {
                  return;
               }
               if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const message = value.trim();
                  if (message && !disabled) {
                     void onSend(message);
                     setValue('');
                  }
               }
            }}
            disabled={disabled}
         />
         <div ref={emojiPickerRef} className="relative">
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
               <div className="app-scroll absolute bottom-14 right-0 z-30 grid max-h-72 w-72 grid-cols-6 gap-2 overflow-y-auto rounded-xl bg-[#23244a] p-3 shadow-lg">
                  {EMOJIS.map((emoji) => (
                     <button
                        key={emoji}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl transition hover:scale-110 hover:bg-white/5"
                        type="button"
                        onClick={() => handleEmojiSelect(emoji)}
                     >
                        {emoji}
                     </button>
                  ))}
               </div>
            )}
         </div>
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
