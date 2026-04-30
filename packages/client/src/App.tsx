import { useCallback, useEffect, useMemo, useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { ChatContainer } from './components/layout/ChatContainer';
import { ChatThread } from './components/chat/ChatThread';
import {
   createAccount,
   updateAccountProfile,
   signOut,
   signIn,
   subscribeToAuthUser,
   type AuthUser,
} from './lib/auth-storage';
import { navigateTo, usePathname } from './lib/navigation';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { auth } from './lib/firebase';
import {
   ApiRequestError,
   fetchConversationHistory,
   type ConversationSummary,
} from './lib/conversation-history-api';
import {
   clearGuestChatData,
   defaultAppSettings,
   loadAppSettings,
   resolveThemeMode,
   saveAppSettings,
   type AppSettings,
   type ThemeMode,
} from './lib/app-settings';
import {
   deleteAccount,
   deleteAllConversations,
   downloadTextFile,
   exportConversationsAsCsv,
   exportConversationsAsJson,
   toPrettyJson,
} from './lib/settings-api';
import { SettingsModal } from './components/settings/SettingsModal';
import { loadTemplates, type PromptTemplate } from './lib/template-store';
import {
   archiveProjectWorkspace,
   createProjectWorkspace,
   deleteProjectWorkspace,
   duplicateProjectWorkspace,
   listProjectWorkspaces,
   updateProjectWorkspace,
   type ProjectWorkspace,
} from './lib/project-workspaces';
import { MyProjectsPage } from './pages/MyProjectsPage';
import { isFirestorePermissionDenied } from './lib/firebase-errors';
import {
   fetchAnalyticsSummary,
   exportAnalyticsCsv,
   type AnalyticsSummary,
} from './lib/analytics-api';
import { StatisticsPage } from './pages/StatisticsPage';

const GUEST_LIMIT = 20;
const GUEST_COUNT_KEY = 'assistly-guest-question-count';
const ACTIVE_PROJECT_KEY_PREFIX = 'assistly-active-project';

interface PendingTemplateRun {
   templateId?: string;
   templateTitle?: string;
   templateVersion?: number;
}

function todayUsageKey() {
   const today = new Date().toISOString().slice(0, 10);
   return `assistly-questions:${today}`;
}

function readTodayQuestionCount() {
   try {
      const value = Number(window.localStorage.getItem(todayUsageKey()) || '0');
      return Number.isFinite(value) ? value : 0;
   } catch {
      return 0;
   }
}

function incrementTodayQuestionCount() {
   const current = readTodayQuestionCount();
   const next = current + 1;
   window.localStorage.setItem(todayUsageKey(), String(next));
   return next;
}

function readGuestQuestionCount() {
   try {
      const value = Number(window.localStorage.getItem(GUEST_COUNT_KEY) || '0');
      return Number.isFinite(value) ? value : 0;
   } catch {
      return 0;
   }
}

function activeProjectStorageKey(uid: string | null) {
   return `${ACTIVE_PROJECT_KEY_PREFIX}:${uid || 'guest'}`;
}

function readActiveProjectId(uid: string | null) {
   try {
      return window.localStorage.getItem(activeProjectStorageKey(uid));
   } catch {
      return null;
   }
}

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
   const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
   const [settingsOpen, setSettingsOpen] = useState(false);
   const [settingsInitialTab, setSettingsInitialTab] = useState<
      | 'profile'
      | 'appearance'
      | 'chat'
      | 'privacy'
      | 'notifications'
      | 'usage'
      | 'help'
   >('profile');
   const [questionsToday, setQuestionsToday] = useState(() =>
      readTodayQuestionCount()
   );
   const [templates, setTemplates] = useState<PromptTemplate[]>([]);
   const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
   const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
      null
   );
   const [chatPrefillMessage, setChatPrefillMessage] = useState('');
   const [chatPrefillNonce, setChatPrefillNonce] = useState(0);
   const [pendingTemplateRun, setPendingTemplateRun] =
      useState<PendingTemplateRun | null>(null);
   const [projectsPermissionBlocked, setProjectsPermissionBlocked] =
      useState(false);
   const [projectsError, setProjectsError] = useState<string | null>(null);
   const [analyticsWindowDays, setAnalyticsWindowDays] = useState(30);
   const [analyticsSummary, setAnalyticsSummary] =
      useState<AnalyticsSummary | null>(null);
   const [analyticsLoading, setAnalyticsLoading] = useState(false);
   const [analyticsError, setAnalyticsError] = useState<string | null>(null);

   useEffect(() => {
      const unsubscribe = subscribeToAuthUser((user) => {
         setSessionUser(user);
         const loadedSettings = loadAppSettings(user?.uid || null);
         setTemplates(loadTemplates(user));
         setSettings(loadedSettings);
         setSelectedProjectId(readActiveProjectId(user?.uid || null));
         setShouldLoadLatestConversation(!loadedSettings.startNewChatOnOpen);
         setQuestionsToday(readTodayQuestionCount());
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
      saveAppSettings(sessionUser?.uid || null, settings);
   }, [sessionUser?.uid, settings]);

   useEffect(() => {
      const resolvedTheme = resolveThemeMode(settings.themeMode);
      document.documentElement.classList.toggle(
         'theme-light',
         resolvedTheme === 'light'
      );
   }, [settings.themeMode]);

   useEffect(() => {
      try {
         if (selectedProjectId) {
            window.localStorage.setItem(
               activeProjectStorageKey(sessionUser?.uid || null),
               selectedProjectId
            );
         } else {
            window.localStorage.removeItem(
               activeProjectStorageKey(sessionUser?.uid || null)
            );
         }
      } catch {
         // ignore local storage issues
      }
   }, [selectedProjectId, sessionUser?.uid]);

   useEffect(() => {
      let cancelled = false;

      async function syncProjects() {
         if (!sessionUser) {
            if (!cancelled) {
               setProjects([]);
               setSelectedProjectId(null);
               setProjectsPermissionBlocked(false);
               setProjectsError(null);
            }
            return;
         }

         try {
            const loadedProjects = await listProjectWorkspaces(
               sessionUser.uid,
               true
            );
            if (cancelled) {
               return;
            }

            setProjects(loadedProjects);
            setProjectsPermissionBlocked(false);
            setProjectsError(null);
            if (
               selectedProjectId &&
               !loadedProjects.some((item) => item.id === selectedProjectId)
            ) {
               setSelectedProjectId(null);
            }
         } catch (error) {
            if (!cancelled) {
               setProjects([]);
               if (isFirestorePermissionDenied(error)) {
                  setProjectsPermissionBlocked(true);
                  setProjectsError(
                     'Project workspace access is blocked by Firestore rules.'
                  );
               } else {
                  console.error('Failed to load projects', error);
                  setProjectsError('Failed to load projects.');
               }
            }
         }
      }

      void syncProjects();

      return () => {
         cancelled = true;
      };
   }, [sessionUser, selectedProjectId]);

   useEffect(() => {
      if (pathname !== '/chat' || !chatPrefillMessage.trim()) {
         return;
      }

      const timer = window.setTimeout(() => {
         setChatPrefillMessage('');
      }, 0);

      return () => {
         window.clearTimeout(timer);
      };
   }, [chatPrefillMessage, pathname]);

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

   useEffect(() => {
      let cancelled = false;

      async function syncAnalytics() {
         if (pathname !== '/stats') {
            return;
         }

         if (!sessionUser) {
            if (!cancelled) {
               setAnalyticsSummary(null);
               setAnalyticsError(null);
               setAnalyticsLoading(false);
            }
            return;
         }

         const idToken = await auth.currentUser?.getIdToken();
         if (!idToken) {
            if (!cancelled) {
               setAnalyticsError(
                  'Authentication expired. Please sign in again.'
               );
            }
            return;
         }

         if (!cancelled) {
            setAnalyticsLoading(true);
            setAnalyticsError(null);
         }

         try {
            const summary = await fetchAnalyticsSummary(
               idToken,
               analyticsWindowDays
            );
            if (!cancelled) {
               setAnalyticsSummary(summary);
            }
         } catch (error) {
            if (!cancelled) {
               setAnalyticsError(
                  error instanceof Error
                     ? error.message
                     : 'Failed to load analytics data.'
               );
               setAnalyticsSummary(null);
            }
         } finally {
            if (!cancelled) {
               setAnalyticsLoading(false);
            }
         }
      }

      void syncAnalytics();

      return () => {
         cancelled = true;
      };
   }, [analyticsWindowDays, pathname, sessionUser]);

   const handleSignIn = async ({
      email,
      password,
   }: {
      email: string;
      password: string;
   }) => {
      const user = await signIn({ email, password });
      const loadedSettings = loadAppSettings(user.uid);
      setSessionUser(user);
      setTemplates(loadTemplates(user));
      setSettings(loadedSettings);
      setHistoryAuthBlocked(false);
      setActiveConversationId(null);
      setSelectedProjectId(readActiveProjectId(user.uid));
      setProjectsPermissionBlocked(false);
      setProjectsError(null);
      setAnalyticsSummary(null);
      setAnalyticsError(null);
      setShouldLoadLatestConversation(!loadedSettings.startNewChatOnOpen);
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
      const loadedSettings = loadAppSettings(user.uid);
      setSessionUser(user);
      setTemplates(loadTemplates(user));
      setSettings(loadedSettings);
      setHistoryAuthBlocked(false);
      setActiveConversationId(null);
      setSelectedProjectId(readActiveProjectId(user.uid));
      setProjectsPermissionBlocked(false);
      setProjectsError(null);
      setAnalyticsSummary(null);
      setAnalyticsError(null);
      setShouldLoadLatestConversation(!loadedSettings.startNewChatOnOpen);
      window.localStorage.removeItem('assistly-guest-question-count');
      navigateTo('/chat', true);
   };

   const handleLogout = () => {
      const guestSettings = loadAppSettings(null);
      void signOut().catch((err) => {
         console.error('Failed to sign out from Firebase', err);
      });
      setSessionUser(null);
      setHistoryItems([]);
      setHistoryAuthBlocked(false);
      setProjects([]);
      setTemplates(loadTemplates(null));
      setSettings(guestSettings);
      setActiveConversationId(null);
      setSelectedProjectId(null);
      setProjectsPermissionBlocked(false);
      setProjectsError(null);
      setAnalyticsSummary(null);
      setAnalyticsError(null);
      setShouldLoadLatestConversation(!guestSettings.startNewChatOnOpen);
      navigateTo('/chat', true);
   };

   const handleSelectConversation = useCallback(
      (conversationId: string) => {
         const selectedConversation = historyItems.find(
            (item) => item.conversationId === conversationId
         );
         if (selectedConversation) {
            setSelectedProjectId(selectedConversation.projectId || null);
         }
         setActiveConversationId(conversationId);
         setShouldLoadLatestConversation(false);
         navigateTo('/chat');
      },
      [historyItems]
   );

   const handleNewConversation = useCallback(() => {
      setActiveConversationId(null);
      setShouldLoadLatestConversation(false);
      setPendingTemplateRun(null);
      navigateTo('/chat');
   }, []);

   const handleUseTemplate = useCallback((template: PromptTemplate) => {
      setChatPrefillMessage(template.body);
      setChatPrefillNonce((value) => value + 1);
      setPendingTemplateRun({
         templateId: template.id,
         templateTitle: template.title,
         templateVersion: template.version,
      });
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

   const handleSelectProject = useCallback((projectId: string | null) => {
      setSelectedProjectId(projectId);
      setActiveConversationId(null);
      setShouldLoadLatestConversation(false);
      navigateTo('/chat');
   }, []);

   const refreshProjects = useCallback(async () => {
      if (!sessionUser) {
         setProjects([]);
         return;
      }
      try {
         const loaded = await listProjectWorkspaces(sessionUser.uid, true);
         setProjects(loaded);
         setProjectsPermissionBlocked(false);
         setProjectsError(null);
      } catch (error) {
         if (isFirestorePermissionDenied(error)) {
            setProjectsPermissionBlocked(true);
            setProjectsError(
               'Project workspace access is blocked by Firestore rules.'
            );
            return;
         }
         console.error('Failed to refresh projects', error);
         setProjectsError('Failed to refresh projects.');
      }
   }, [sessionUser]);

   const handleCreateProject = useCallback(
      async (payload: {
         name: string;
         description: string;
         context: string;
         links: string[];
         docs: string[];
         owner: string;
         collaborators: string[];
      }) => {
         if (!sessionUser) {
            return;
         }
         try {
            const created = await createProjectWorkspace(
               sessionUser.uid,
               payload
            );
            await refreshProjects();
            setSelectedProjectId(created.id);
         } catch (error) {
            if (isFirestorePermissionDenied(error)) {
               setProjectsPermissionBlocked(true);
               setProjectsError(
                  'You do not have permission to create projects yet.'
               );
               return;
            }
            console.error('Failed to create project', error);
            setProjectsError('Failed to create project.');
         }
      },
      [refreshProjects, sessionUser]
   );

   const handleRenameProject = useCallback(
      async (projectId: string, name: string) => {
         if (!sessionUser) {
            return;
         }
         try {
            await updateProjectWorkspace(sessionUser.uid, projectId, { name });
            await refreshProjects();
         } catch (error) {
            if (isFirestorePermissionDenied(error)) {
               setProjectsPermissionBlocked(true);
               setProjectsError('You do not have permission to edit projects.');
               return;
            }
            console.error('Failed to rename project', error);
            setProjectsError('Failed to rename project.');
         }
      },
      [refreshProjects, sessionUser]
   );

   const handleEditProject = useCallback(
      async (
         projectId: string,
         payload: {
            description: string;
            context: string;
            links: string[];
            docs: string[];
            owner: string;
            collaborators: string[];
         }
      ) => {
         if (!sessionUser) {
            return;
         }
         try {
            await updateProjectWorkspace(sessionUser.uid, projectId, payload);
            await refreshProjects();
         } catch (error) {
            if (isFirestorePermissionDenied(error)) {
               setProjectsPermissionBlocked(true);
               setProjectsError('You do not have permission to edit projects.');
               return;
            }
            console.error('Failed to update project', error);
            setProjectsError('Failed to update project.');
         }
      },
      [refreshProjects, sessionUser]
   );

   const handleDuplicateProject = useCallback(
      async (projectId: string) => {
         if (!sessionUser) {
            return;
         }
         try {
            await duplicateProjectWorkspace(sessionUser.uid, projectId);
            await refreshProjects();
         } catch (error) {
            if (isFirestorePermissionDenied(error)) {
               setProjectsPermissionBlocked(true);
               setProjectsError(
                  'You do not have permission to duplicate projects.'
               );
               return;
            }
            console.error('Failed to duplicate project', error);
            setProjectsError('Failed to duplicate project.');
         }
      },
      [refreshProjects, sessionUser]
   );

   const handleArchiveProject = useCallback(
      async (projectId: string, archived: boolean) => {
         if (!sessionUser) {
            return;
         }
         try {
            await archiveProjectWorkspace(sessionUser.uid, projectId, archived);
            await refreshProjects();
         } catch (error) {
            if (isFirestorePermissionDenied(error)) {
               setProjectsPermissionBlocked(true);
               setProjectsError(
                  'You do not have permission to archive projects.'
               );
               return;
            }
            console.error('Failed to archive project', error);
            setProjectsError('Failed to archive project.');
         }
      },
      [refreshProjects, sessionUser]
   );

   const handleDeleteProject = useCallback(
      async (projectId: string) => {
         if (!sessionUser) {
            return;
         }
         try {
            await deleteProjectWorkspace(sessionUser.uid, projectId);
            if (selectedProjectId === projectId) {
               setSelectedProjectId(null);
               setActiveConversationId(null);
            }
            await refreshProjects();
         } catch (error) {
            if (isFirestorePermissionDenied(error)) {
               setProjectsPermissionBlocked(true);
               setProjectsError(
                  'You do not have permission to delete projects.'
               );
               return;
            }
            console.error('Failed to delete project', error);
            setProjectsError('Failed to delete project.');
         }
      },
      [refreshProjects, selectedProjectId, sessionUser]
   );

   const handleQuestionAsked = useCallback(() => {
      const next = incrementTodayQuestionCount();
      setQuestionsToday(next);
   }, []);

   const cycleTheme = useCallback(() => {
      setSettings((current) => {
         const nextMode: ThemeMode =
            current.themeMode === 'dark'
               ? 'light'
               : current.themeMode === 'light'
                 ? 'system'
                 : 'dark';
         return { ...current, themeMode: nextMode };
      });
   }, []);

   const openSettings = useCallback(
      (
         tab:
            | 'profile'
            | 'appearance'
            | 'chat'
            | 'privacy'
            | 'notifications'
            | 'usage'
            | 'help' = 'profile'
      ) => {
         setSettingsInitialTab(tab);
         setSettingsOpen(true);
      },
      []
   );

   const handleSettingsChange = useCallback(
      (next: AppSettings) => {
         setSettings(next);
         if (activeConversationId === null) {
            setShouldLoadLatestConversation(!next.startNewChatOnOpen);
         }
      },
      [activeConversationId]
   );

   const runWithFreshToken = async <T,>(
      callback: (token: string) => Promise<T>
   ) => {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) {
         throw new Error('Authentication expired. Please sign in again.');
      }
      return callback(token);
   };

   const handleExportJson = async () => {
      await runWithFreshToken(async (token) => {
         const conversations = await exportConversationsAsJson(token);
         downloadTextFile(
            'assistly-conversations.json',
            toPrettyJson({ conversations })
         );
      });
   };

   const handleExportCsv = async () => {
      await runWithFreshToken(async (token) => {
         const csv = await exportConversationsAsCsv(token);
         downloadTextFile('assistly-conversations.csv', csv);
      });
   };

   const handleDeleteConversations = async () => {
      await runWithFreshToken(async (token) => {
         await deleteAllConversations(token);
      });
      setActiveConversationId(null);
      setShouldLoadLatestConversation(false);
      setHistoryVersion((value) => value + 1);
   };

   const handleDeleteAccount = async () => {
      await runWithFreshToken(async (token) => {
         await deleteAccount(token);
      });
      await signOut();
      setSessionUser(null);
      setHistoryItems([]);
      setHistoryAuthBlocked(false);
      setSettings(loadAppSettings(null));
      setActiveConversationId(null);
      setShouldLoadLatestConversation(false);
      setSettingsOpen(false);
      navigateTo('/chat', true);
   };

   const handleSaveProfile = async (fullName: string) => {
      const updated = await updateAccountProfile({ fullName });
      setSessionUser(updated);
   };

   const handleExportAnalyticsCsv = useCallback(async () => {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) {
         throw new Error('Authentication expired. Please sign in again.');
      }
      const csv = await exportAnalyticsCsv(token, analyticsWindowDays);
      downloadTextFile(`assistly-analytics-${analyticsWindowDays}d.csv`, csv);
   }, [analyticsWindowDays]);

   const guestRemaining = Math.max(0, GUEST_LIMIT - readGuestQuestionCount());
   const visibleHistoryItems = useMemo(() => {
      if (!selectedProjectId) {
         return historyItems;
      }
      return historyItems.filter(
         (item) => item.projectId === selectedProjectId
      );
   }, [historyItems, selectedProjectId]);
   const conversationSummariesByProjectId = useMemo(() => {
      const result: Record<
         string,
         { conversationCount: number; lastConversationAt: string | null }
      > = {};

      for (const item of historyItems) {
         if (!item.projectId) {
            continue;
         }
         const current = result[item.projectId] || {
            conversationCount: 0,
            lastConversationAt: null,
         };
         const candidateTime = item.updatedAt || item.createdAt;
         const currentTime = current.lastConversationAt;
         const resolvedLast =
            !currentTime ||
            (candidateTime &&
               new Date(candidateTime).getTime() >
                  new Date(currentTime).getTime())
               ? candidateTime
               : currentTime;

         result[item.projectId] = {
            conversationCount: current.conversationCount + 1,
            lastConversationAt: resolvedLast || null,
         };
      }

      return result;
   }, [historyItems]);

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
            onOpenSettings={() => openSettings('profile')}
            onOpenHelp={() => openSettings('help')}
            themeMode={settings.themeMode}
            onCycleTheme={cycleTheme}
            inAppNotifications={settings.inAppNotifications}
            muteAllNotifications={settings.muteAllNotifications}
            projects={[]}
            selectedProjectId={null}
            onSelectProject={handleSelectProject}
            onOpenProjects={() => navigateTo('/projects')}
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

   if (pathname === '/templates') {
      return (
         <>
            <MainLayout
               currentUser={sessionUser}
               onSignInClick={() => navigateTo('/signin')}
               onSignUpClick={() => navigateTo('/signup')}
               onLogout={handleLogout}
               historyItems={visibleHistoryItems}
               historyLoading={historyLoading}
               activeConversationId={activeConversationId}
               onSelectConversation={handleSelectConversation}
               onNewConversation={handleNewConversation}
               onOpenSettings={() => openSettings('profile')}
               onOpenHelp={() => openSettings('help')}
               themeMode={settings.themeMode}
               onCycleTheme={cycleTheme}
               inAppNotifications={settings.inAppNotifications}
               muteAllNotifications={settings.muteAllNotifications}
               projects={projects}
               selectedProjectId={selectedProjectId}
               onSelectProject={handleSelectProject}
               onOpenProjects={() => navigateTo('/projects')}
            >
               <TemplatesPage
                  currentUser={sessionUser}
                  templates={templates}
                  onTemplatesChange={setTemplates}
                  onUseTemplate={handleUseTemplate}
               />
            </MainLayout>
            {settingsOpen && (
               <SettingsModal
                  open={settingsOpen}
                  initialTab={settingsInitialTab}
                  onClose={() => setSettingsOpen(false)}
                  currentUser={sessionUser}
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  onSaveProfile={handleSaveProfile}
                  onExportJson={handleExportJson}
                  onExportCsv={handleExportCsv}
                  onDeleteConversations={handleDeleteConversations}
                  onDeleteAccount={handleDeleteAccount}
                  onClearGuestData={clearGuestChatData}
                  questionsToday={questionsToday}
                  guestRemaining={guestRemaining}
                  historyCount={historyItems.length}
               />
            )}
         </>
      );
   }

   if (pathname === '/projects') {
      return (
         <>
            <MainLayout
               currentUser={sessionUser}
               onSignInClick={() => navigateTo('/signin')}
               onSignUpClick={() => navigateTo('/signup')}
               onLogout={handleLogout}
               historyItems={visibleHistoryItems}
               historyLoading={historyLoading}
               activeConversationId={activeConversationId}
               onSelectConversation={handleSelectConversation}
               onNewConversation={handleNewConversation}
               onOpenSettings={() => openSettings('profile')}
               onOpenHelp={() => openSettings('help')}
               themeMode={settings.themeMode}
               onCycleTheme={cycleTheme}
               inAppNotifications={settings.inAppNotifications}
               muteAllNotifications={settings.muteAllNotifications}
               projects={projects}
               selectedProjectId={selectedProjectId}
               onSelectProject={handleSelectProject}
               onOpenProjects={() => navigateTo('/projects')}
            >
               <MyProjectsPage
                  canManageProjects={Boolean(sessionUser)}
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  summariesByProjectId={conversationSummariesByProjectId}
                  permissionBlocked={projectsPermissionBlocked}
                  errorMessage={projectsError}
                  onOpenProject={(projectId) => handleSelectProject(projectId)}
                  onCreateProject={handleCreateProject}
                  onRenameProject={handleRenameProject}
                  onEditProject={handleEditProject}
                  onDuplicateProject={handleDuplicateProject}
                  onArchiveProject={handleArchiveProject}
                  onDeleteProject={handleDeleteProject}
               />
            </MainLayout>
            {settingsOpen && (
               <SettingsModal
                  open={settingsOpen}
                  initialTab={settingsInitialTab}
                  onClose={() => setSettingsOpen(false)}
                  currentUser={sessionUser}
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  onSaveProfile={handleSaveProfile}
                  onExportJson={handleExportJson}
                  onExportCsv={handleExportCsv}
                  onDeleteConversations={handleDeleteConversations}
                  onDeleteAccount={handleDeleteAccount}
                  onClearGuestData={clearGuestChatData}
                  questionsToday={questionsToday}
                  guestRemaining={guestRemaining}
                  historyCount={historyItems.length}
               />
            )}
         </>
      );
   }

   if (pathname === '/stats') {
      return (
         <>
            <MainLayout
               currentUser={sessionUser}
               onSignInClick={() => navigateTo('/signin')}
               onSignUpClick={() => navigateTo('/signup')}
               onLogout={handleLogout}
               historyItems={visibleHistoryItems}
               historyLoading={historyLoading}
               activeConversationId={activeConversationId}
               onSelectConversation={handleSelectConversation}
               onNewConversation={handleNewConversation}
               onOpenSettings={() => openSettings('profile')}
               onOpenHelp={() => openSettings('help')}
               themeMode={settings.themeMode}
               onCycleTheme={cycleTheme}
               inAppNotifications={settings.inAppNotifications}
               muteAllNotifications={settings.muteAllNotifications}
               projects={projects}
               selectedProjectId={selectedProjectId}
               onSelectProject={handleSelectProject}
               onOpenProjects={() => navigateTo('/projects')}
            >
               <StatisticsPage
                  currentUserEmail={sessionUser?.email || null}
                  summary={analyticsSummary}
                  loading={analyticsLoading}
                  error={analyticsError}
                  windowDays={analyticsWindowDays}
                  onWindowDaysChange={setAnalyticsWindowDays}
                  onExportCsv={() => {
                     void handleExportAnalyticsCsv().catch((error) => {
                        setAnalyticsError(
                           error instanceof Error
                              ? error.message
                              : 'Failed to export analytics CSV.'
                        );
                     });
                  }}
               />
            </MainLayout>
            {settingsOpen && (
               <SettingsModal
                  open={settingsOpen}
                  initialTab={settingsInitialTab}
                  onClose={() => setSettingsOpen(false)}
                  currentUser={sessionUser}
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  onSaveProfile={handleSaveProfile}
                  onExportJson={handleExportJson}
                  onExportCsv={handleExportCsv}
                  onDeleteConversations={handleDeleteConversations}
                  onDeleteAccount={handleDeleteAccount}
                  onClearGuestData={clearGuestChatData}
                  questionsToday={questionsToday}
                  guestRemaining={guestRemaining}
                  historyCount={historyItems.length}
               />
            )}
         </>
      );
   }

   return (
      <>
         <MainLayout
            currentUser={sessionUser}
            onSignInClick={() => navigateTo('/signin')}
            onSignUpClick={() => navigateTo('/signup')}
            onLogout={handleLogout}
            historyItems={visibleHistoryItems}
            historyLoading={historyLoading}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onOpenSettings={() => openSettings('profile')}
            onOpenHelp={() => openSettings('help')}
            themeMode={settings.themeMode}
            onCycleTheme={cycleTheme}
            inAppNotifications={settings.inAppNotifications}
            muteAllNotifications={settings.muteAllNotifications}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
            onOpenProjects={() => navigateTo('/projects')}
         >
            <ChatContainer>
               <ChatThread
                  currentUser={sessionUser}
                  currentProjectId={selectedProjectId}
                  activeConversationId={activeConversationId}
                  shouldLoadLatestConversation={shouldLoadLatestConversation}
                  onConversationResolved={handleConversationResolved}
                  onConversationUpdated={handleConversationUpdated}
                  enterToSend={settings.enterToSend}
                  showTimestamps={settings.showTimestamps}
                  chatFontSize={settings.chatFontSize}
                  bubbleWidth={settings.bubbleWidth}
                  soundOnResponse={settings.soundOnResponse}
                  muteAllNotifications={settings.muteAllNotifications}
                  onQuestionAsked={handleQuestionAsked}
                  prefillMessage={chatPrefillMessage}
                  prefillNonce={chatPrefillNonce}
                  pendingTemplateRun={pendingTemplateRun}
                  onTemplateRunAttached={() => setPendingTemplateRun(null)}
               />
            </ChatContainer>
         </MainLayout>
         {settingsOpen && (
            <SettingsModal
               open={settingsOpen}
               initialTab={settingsInitialTab}
               onClose={() => setSettingsOpen(false)}
               currentUser={sessionUser}
               settings={settings}
               onSettingsChange={handleSettingsChange}
               onSaveProfile={handleSaveProfile}
               onExportJson={handleExportJson}
               onExportCsv={handleExportCsv}
               onDeleteConversations={handleDeleteConversations}
               onDeleteAccount={handleDeleteAccount}
               onClearGuestData={clearGuestChatData}
               questionsToday={questionsToday}
               guestRemaining={guestRemaining}
               historyCount={historyItems.length}
            />
         )}
      </>
   );
}

export default App;
