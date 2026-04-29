import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { AuthUser } from '../../lib/auth-storage';

interface MainLayoutProps {
   children: React.ReactNode;
   currentUser: AuthUser | null;
   onSignInClick: () => void;
   onSignUpClick: () => void;
   onLogout: () => void;
}

export function MainLayout({
   children,
   currentUser,
   onSignInClick,
   onSignUpClick,
   onLogout,
}: MainLayoutProps) {
   return (
      <div className="h-screen overflow-hidden bg-[var(--app-page-bg)]">
         <div className="flex h-full w-full overflow-hidden bg-[var(--app-shell-bg)] shadow-[0_24px_80px_rgba(6,8,18,0.45)]">
            <Sidebar
               currentUser={currentUser}
               onSignInClick={onSignInClick}
               onSignUpClick={onSignUpClick}
               onLogout={onLogout}
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
               <Topbar />
               <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
                  {children}
               </main>
            </div>
         </div>
      </div>
   );
}
