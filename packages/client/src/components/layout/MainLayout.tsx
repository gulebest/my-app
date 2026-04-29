import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { AuthUser } from '../../lib/auth-storage';
import type { ConversationSummary } from '../../lib/conversation-history-api';

interface MainLayoutProps {
   children: React.ReactNode;
   currentUser: AuthUser | null;
   onSignInClick: () => void;
   onSignUpClick: () => void;
   onLogout: () => void;
   historyItems: ConversationSummary[];
   historyLoading: boolean;
   activeConversationId: string | null;
   onSelectConversation: (conversationId: string) => void;
   onNewConversation: () => void;
}

export function MainLayout({
   children,
   currentUser,
   onSignInClick,
   onSignUpClick,
   onLogout,
   historyItems,
   historyLoading,
   activeConversationId,
   onSelectConversation,
   onNewConversation,
}: MainLayoutProps) {
   const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

   return (
      <div className="h-screen overflow-hidden bg-[var(--app-page-bg)]">
         <div className="flex h-full w-full overflow-hidden bg-[var(--app-shell-bg)] shadow-[0_24px_80px_rgba(6,8,18,0.45)]">
            <div className="hidden h-full lg:flex">
               <Sidebar
                  currentUser={currentUser}
                  onSignInClick={onSignInClick}
                  onSignUpClick={onSignUpClick}
                  onLogout={onLogout}
                  historyItems={historyItems}
                  historyLoading={historyLoading}
                  activeConversationId={activeConversationId}
                  onSelectConversation={onSelectConversation}
                  onNewConversation={onNewConversation}
               />
            </div>

            {mobileSidebarOpen && (
               <div className="fixed inset-0 z-50 lg:hidden">
                  <button
                     type="button"
                     aria-label="Close sidebar overlay"
                     className="absolute inset-0 bg-black/45"
                     onClick={() => setMobileSidebarOpen(false)}
                  />
                  <div className="absolute inset-y-0 left-0 w-[86vw] max-w-[320px]">
                     <Sidebar
                        currentUser={currentUser}
                        onSignInClick={onSignInClick}
                        onSignUpClick={onSignUpClick}
                        onLogout={onLogout}
                        historyItems={historyItems}
                        historyLoading={historyLoading}
                        activeConversationId={activeConversationId}
                        onSelectConversation={onSelectConversation}
                        onNewConversation={onNewConversation}
                        className="w-full border-r border-[var(--app-divider)] shadow-[0_18px_44px_rgba(0,0,0,0.35)]"
                        onClose={() => setMobileSidebarOpen(false)}
                     />
                  </div>
               </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
               <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />
               <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 md:p-6">
                  {children}
               </main>
            </div>
         </div>
      </div>
   );
}
