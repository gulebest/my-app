import { useEffect, useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { ChatContainer } from './components/layout/ChatContainer';
import { ChatThread } from './components/chat/ChatThread';
import {
   createAccount,
   signOut,
   signIn,
   subscribeToAuthUser,
   type AuthUser,
} from './lib/auth-storage';
import { navigateTo, usePathname } from './lib/navigation';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';

function App() {
   const pathname = usePathname();
   const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
   const [authReady, setAuthReady] = useState(false);

   useEffect(() => {
      const unsubscribe = subscribeToAuthUser((user) => {
         setSessionUser(user);
         setAuthReady(true);
      });

      return unsubscribe;
   }, []);

   useEffect(() => {
      const hasSession = Boolean(sessionUser);
      const onAuthRoute = pathname === '/signin' || pathname === '/signup';

      if (hasSession && onAuthRoute) {
         navigateTo('/chat', true);
      }
   }, [pathname, sessionUser]);

   const handleSignIn = async ({
      email,
      password,
   }: {
      email: string;
      password: string;
   }) => {
      const user = await signIn({ email, password });
      setSessionUser(user);
      window.localStorage.removeItem('assistly-guest-question-count');
      navigateTo('/chat', true);
   };

   const handleSignUp = async ({
      fullName,
      email,
      password,
   }: {
      fullName: string;
      email: string;
      password: string;
   }) => {
      const user = await createAccount({ fullName, email, password });
      setSessionUser(user);
      window.localStorage.removeItem('assistly-guest-question-count');
      navigateTo('/chat', true);
   };

   const handleLogout = () => {
      void signOut().catch((err) => {
         console.error('Failed to sign out from Firebase', err);
      });
      setSessionUser(null);
      navigateTo('/chat', true);
   };

   if (!authReady && pathname !== '/signin' && pathname !== '/signup') {
      return (
         <MainLayout
            currentUser={null}
            onSignInClick={() => navigateTo('/signin')}
            onSignUpClick={() => navigateTo('/signup')}
            onLogout={handleLogout}
         >
            <ChatContainer>
               <div className="flex h-full items-center justify-center text-sm text-(--app-text-muted)">
                  Loading account...
               </div>
            </ChatContainer>
         </MainLayout>
      );
   }

   if (pathname === '/signup') {
      return (
         <SignUpPage
            onSubmit={handleSignUp}
            onSwitchToSignIn={() => navigateTo('/signin')}
         />
      );
   }

   if (pathname === '/signin') {
      return (
         <SignInPage
            onSubmit={handleSignIn}
            onSwitchToSignUp={() => navigateTo('/signup')}
         />
      );
   }

   return (
      <MainLayout
         currentUser={sessionUser}
         onSignInClick={() => navigateTo('/signin')}
         onSignUpClick={() => navigateTo('/signup')}
         onLogout={handleLogout}
      >
         <ChatContainer>
            <ChatThread currentUser={sessionUser} />
         </ChatContainer>
      </MainLayout>
   );
}

export default App;
