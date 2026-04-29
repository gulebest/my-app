import { useCallback, useEffect, useState } from 'react';
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
import { auth } from './lib/firebase';
import {
   ApiRequestError,
   fetchConversationHistory,
   type ConversationSummary,
} from './lib/conversation-history-api';

function App() {
   const pathname = usePathname();
   const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
   const [authReady, setAuthReady] = useState(false);
   const [historyItems, setHistoryItems] = useState<ConversationSummary[]>([]);
   const [historyLoading, setHistoryLoading] = useState(false);
   const [historyVersion, setHistoryVersion] = useState(0);
   const [historyAuthBlocked, setHistoryAuthBlocked] = useState(false);
   const [activeConversationId, setActiveConversationId] = useState<
      string | null
   >(null);
   const [shouldLoadLatestConversation, setShouldLoadLatestConversation] =
      useState(false);

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

   useEffect(() => {
      let cancelled = false;

      async function syncConversationHistory() {
         if (historyAuthBlocked) {
            if (!cancelled) {
               setHistoryLoading(false);
            }
            return;
         }

         if (!sessionUser) {
            if (!cancelled) {
               setHistoryItems([]);
               setHistoryLoading(false);
               setHistoryAuthBlocked(false);
            }
            return;
         }

         const idToken = await auth.currentUser?.getIdToken();
         if (!idToken) {
            if (!cancelled) {
               setHistoryItems([]);
               setHistoryLoading(false);
            }
            return;
         }

         if (!cancelled) {
            setHistoryLoading(true);
         }

         try {
            const conversations = await fetchConversationHistory(idToken);

            if (!cancelled) {
               setHistoryItems(conversations);
               setHistoryAuthBlocked(false);
            }
         } catch (error) {
            const shouldRetryWithFreshToken =
               error instanceof ApiRequestError && error.status === 401;

            if (!shouldRetryWithFreshToken) {
               console.error('Failed to fetch conversation history', error);
               return;
            }

            try {
               const freshToken = await auth.currentUser?.getIdToken(true);
               if (!freshToken) {
                  return;
               }

               const conversations = await fetchConversationHistory(freshToken);
               if (!cancelled) {
                  setHistoryItems(conversations);
                  setHistoryAuthBlocked(false);
               }
            } catch (retryError) {
               console.error(
                  'Failed to fetch conversation history after token refresh',
                  retryError
               );
               if (
                  !cancelled &&
                  retryError instanceof ApiRequestError &&
                  retryError.status === 401
               ) {
                  setHistoryAuthBlocked(true);
               }
            }
         } finally {
            if (!cancelled) {
               setHistoryLoading(false);
            }
         }
      }

      void syncConversationHistory();

      return () => {
         cancelled = true;
      };
   }, [historyAuthBlocked, historyVersion, sessionUser]);

   const handleSignIn = async ({
      email,
      password,
   }: {
      email: string;
      password: string;
   }) => {
      const user = await signIn({ email, password });
      setSessionUser(user);
      setHistoryAuthBlocked(false);
      setActiveConversationId(null);
      setShouldLoadLatestConversation(false);
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
      setHistoryAuthBlocked(false);
      setActiveConversationId(null);
      setShouldLoadLatestConversation(false);
      window.localStorage.removeItem('assistly-guest-question-count');
      navigateTo('/chat', true);
   };

   const handleLogout = () => {
      void signOut().catch((err) => {
         console.error('Failed to sign out from Firebase', err);
      });
      setSessionUser(null);
      setHistoryItems([]);
      setHistoryAuthBlocked(false);
      setActiveConversationId(null);
      setShouldLoadLatestConversation(false);
      navigateTo('/chat', true);
   };

   const handleSelectConversation = useCallback((conversationId: string) => {
      setActiveConversationId(conversationId);
      setShouldLoadLatestConversation(false);
      navigateTo('/chat');
   }, []);

   const handleNewConversation = useCallback(() => {
      setActiveConversationId(null);
      setShouldLoadLatestConversation(false);
      navigateTo('/chat');
   }, []);

   const handleConversationResolved = useCallback((conversationId: string) => {
      setActiveConversationId(conversationId);
      setShouldLoadLatestConversation(false);
   }, []);

   const handleConversationUpdated = useCallback(() => {
      setHistoryVersion((version) => version + 1);
   }, []);

   if (!authReady && pathname !== '/signin' && pathname !== '/signup') {
      return (
         <MainLayout
            currentUser={null}
            onSignInClick={() => navigateTo('/signin')}
            onSignUpClick={() => navigateTo('/signup')}
            onLogout={handleLogout}
            historyItems={[]}
            historyLoading={false}
            activeConversationId={null}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
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
         historyItems={historyItems}
         historyLoading={historyLoading}
         activeConversationId={activeConversationId}
         onSelectConversation={handleSelectConversation}
         onNewConversation={handleNewConversation}
      >
         <ChatContainer>
            <ChatThread
               currentUser={sessionUser}
               activeConversationId={activeConversationId}
               shouldLoadLatestConversation={shouldLoadLatestConversation}
               onConversationResolved={handleConversationResolved}
               onConversationUpdated={handleConversationUpdated}
            />
         </ChatContainer>
      </MainLayout>
   );
}

export default App;
