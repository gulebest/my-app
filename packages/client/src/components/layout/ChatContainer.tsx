import React from 'react';

export function ChatContainer({ children }: { children: React.ReactNode }) {
   return (
      <section className="flex h-full min-h-0 flex-1 flex-col rounded-2xl border border-[var(--app-chat-border)] bg-gradient-to-br from-[var(--app-chat-from)] via-[var(--app-chat-via)] to-[var(--app-chat-to)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_45px_rgba(8,10,24,0.4)] sm:rounded-[1.75rem] sm:p-6">
         {children}
      </section>
   );
}
