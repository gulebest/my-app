import { useMemo, useState } from 'react';
import {
   X,
   Download,
   Trash2,
   UserRoundX,
   CheckCircle2,
   AlertTriangle,
} from 'lucide-react';
import type { AuthUser } from '../../lib/auth-storage';
import type { AppSettings, ThemeMode } from '../../lib/app-settings';

type SettingsTab =
   | 'profile'
   | 'appearance'
   | 'chat'
   | 'privacy'
   | 'notifications'
   | 'usage'
   | 'help';

interface SettingsModalProps {
   open: boolean;
   initialTab?: SettingsTab;
   onClose: () => void;
   currentUser: AuthUser | null;
   settings: AppSettings;
   onSettingsChange: (settings: AppSettings) => void;
   onSaveProfile: (fullName: string) => Promise<void>;
   onExportJson: () => Promise<void>;
   onExportCsv: () => Promise<void>;
   onDeleteConversations: () => Promise<void>;
   onDeleteAccount: () => Promise<void>;
   onClearGuestData: () => void;
   questionsToday: number;
   guestRemaining: number;
   historyCount: number;
}

const tabs: { id: SettingsTab; label: string }[] = [
   { id: 'profile', label: 'Profile' },
   { id: 'appearance', label: 'Appearance' },
   { id: 'chat', label: 'Chat' },
   { id: 'privacy', label: 'Privacy & Data' },
   { id: 'notifications', label: 'Notifications' },
   { id: 'usage', label: 'Usage' },
   { id: 'help', label: 'Help' },
];

function themeLabel(mode: ThemeMode) {
   if (mode === 'light') {
      return 'Light';
   }
   if (mode === 'dark') {
      return 'Dark';
   }
   return 'System';
}

export function SettingsModal({
   open,
   initialTab = 'profile',
   onClose,
   currentUser,
   settings,
   onSettingsChange,
   onSaveProfile,
   onExportJson,
   onExportCsv,
   onDeleteConversations,
   onDeleteAccount,
   onClearGuestData,
   questionsToday,
   guestRemaining,
   historyCount,
}: SettingsModalProps) {
   const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
   const [profileName, setProfileName] = useState(currentUser?.fullName || '');
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const [statusError, setStatusError] = useState<string | null>(null);
   const [busyAction, setBusyAction] = useState<string | null>(null);

   const initials = useMemo(() => {
      const source = currentUser?.fullName || currentUser?.email || 'Guest';
      const parts = source.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) {
         return 'G';
      }
      return parts
         .slice(0, 2)
         .map((item) => item[0]?.toUpperCase() || '')
         .join('');
   }, [currentUser?.email, currentUser?.fullName]);

   if (!open) {
      return null;
   }

   const runAction = async (key: string, action: () => Promise<void>) => {
      setBusyAction(key);
      setStatusError(null);
      setStatusMessage(null);
      try {
         await action();
      } catch (error) {
         setStatusError(
            error instanceof Error ? error.message : 'Action failed'
         );
      } finally {
         setBusyAction(null);
      }
   };

   return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-3 py-5 sm:px-6">
         <div className="flex h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[var(--app-divider)] bg-[var(--app-shell-bg)] shadow-[0_30px_80px_rgba(6,8,18,0.55)]">
            <aside className="hidden w-56 flex-none border-r border-[var(--app-divider)] bg-[var(--app-sidebar-bg)] p-4 md:block">
               <h2 className="mb-4 text-sm font-semibold text-(--app-text-strong)">
                  Settings
               </h2>
               <div className="space-y-1">
                  {tabs.map((tab) => (
                     <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                           activeTab === tab.id
                              ? 'bg-indigo-500/25 text-white'
                              : 'text-(--app-text-muted) hover:bg-[var(--app-soft-surface)]'
                        }`}
                     >
                        {tab.label}
                     </button>
                  ))}
               </div>
            </aside>

            <section className="app-scroll flex min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
               <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                     <h3 className="text-xl font-semibold text-(--app-text-strong)">
                        Settings
                     </h3>
                     <p className="text-sm text-(--app-text-muted)">
                        Configure your account and chat experience.
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={onClose}
                     className="rounded-lg p-2 text-(--app-text-muted) transition hover:bg-[var(--app-soft-surface)]"
                  >
                     <X className="h-5 w-5" />
                  </button>
               </div>

               <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
                  {tabs.map((tab) => (
                     <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
                           activeTab === tab.id
                              ? 'bg-indigo-500/25 text-white'
                              : 'text-(--app-text-muted) hover:bg-[var(--app-soft-surface)]'
                        }`}
                     >
                        {tab.label}
                     </button>
                  ))}
               </div>

               {statusMessage && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                     <CheckCircle2 className="h-4 w-4" />
                     {statusMessage}
                  </div>
               )}
               {statusError && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                     <AlertTriangle className="h-4 w-4" />
                     {statusError}
                  </div>
               )}

               {activeTab === 'profile' && (
                  <div className="space-y-4">
                     <div className="flex items-center gap-4 rounded-2xl border border-[var(--app-divider)] bg-[var(--app-card-bg)] p-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/30 text-lg font-semibold text-white">
                           {initials}
                        </div>
                        <div>
                           <p className="font-semibold text-(--app-text-strong)">
                              Account Profile
                           </p>
                           <p className="text-sm text-(--app-text-muted)">
                              Manage your visible identity.
                           </p>
                        </div>
                     </div>

                     <label className="block text-sm text-(--app-text-muted)">
                        Full Name
                        <input
                           value={profileName}
                           onChange={(e) => setProfileName(e.target.value)}
                           className="mt-2 w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-(--app-text-strong) outline-none"
                        />
                     </label>

                     <label className="block text-sm text-(--app-text-muted)">
                        Email
                        <input
                           value={currentUser?.email || 'Guest'}
                           readOnly
                           className="mt-2 w-full cursor-not-allowed rounded-xl border border-(--app-input-border) bg-[var(--app-soft-surface)] px-3 py-2 text-(--app-text-muted) outline-none"
                        />
                     </label>

                     <button
                        type="button"
                        disabled={!currentUser || busyAction === 'save-profile'}
                        onClick={() =>
                           void runAction('save-profile', async () => {
                              await onSaveProfile(profileName);
                              setStatusMessage('Profile updated successfully.');
                           })
                        }
                        className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                     >
                        {busyAction === 'save-profile'
                           ? 'Saving...'
                           : 'Save Profile'}
                     </button>
                  </div>
               )}

               {activeTab === 'appearance' && (
                  <div className="space-y-5">
                     <div>
                        <p className="mb-2 text-sm font-medium text-(--app-text-strong)">
                           Theme
                        </p>
                        <div className="flex flex-wrap gap-2">
                           {(['dark', 'light', 'system'] as ThemeMode[]).map(
                              (mode) => (
                                 <button
                                    key={mode}
                                    type="button"
                                    onClick={() =>
                                       onSettingsChange({
                                          ...settings,
                                          themeMode: mode,
                                       })
                                    }
                                    className={`rounded-xl px-3 py-2 text-sm transition ${
                                       settings.themeMode === mode
                                          ? 'bg-indigo-500 text-white'
                                          : 'bg-[var(--app-soft-surface)] text-(--app-text-muted)'
                                    }`}
                                 >
                                    {themeLabel(mode)}
                                 </button>
                              )
                           )}
                        </div>
                     </div>

                     <div>
                        <p className="mb-2 text-sm font-medium text-(--app-text-strong)">
                           Chat Font Size
                        </p>
                        <div className="flex flex-wrap gap-2">
                           {(['small', 'medium', 'large'] as const).map(
                              (size) => (
                                 <button
                                    key={size}
                                    type="button"
                                    onClick={() =>
                                       onSettingsChange({
                                          ...settings,
                                          chatFontSize: size,
                                       })
                                    }
                                    className={`rounded-xl px-3 py-2 text-sm capitalize transition ${
                                       settings.chatFontSize === size
                                          ? 'bg-indigo-500 text-white'
                                          : 'bg-[var(--app-soft-surface)] text-(--app-text-muted)'
                                    }`}
                                 >
                                    {size}
                                 </button>
                              )
                           )}
                        </div>
                     </div>

                     <div>
                        <p className="mb-2 text-sm font-medium text-(--app-text-strong)">
                           Bubble Width: {settings.bubbleWidth}%
                        </p>
                        <input
                           type="range"
                           min={60}
                           max={90}
                           value={settings.bubbleWidth}
                           onChange={(e) =>
                              onSettingsChange({
                                 ...settings,
                                 bubbleWidth: Number(e.target.value),
                              })
                           }
                           className="w-full accent-indigo-500"
                        />
                     </div>
                  </div>
               )}

               {activeTab === 'chat' && (
                  <div className="space-y-4">
                     <ToggleItem
                        label="Start new chat on app open"
                        value={settings.startNewChatOnOpen}
                        onChange={(value) =>
                           onSettingsChange({
                              ...settings,
                              startNewChatOnOpen: value,
                           })
                        }
                     />
                     <ToggleItem
                        label="Enter to send"
                        value={settings.enterToSend}
                        onChange={(value) =>
                           onSettingsChange({ ...settings, enterToSend: value })
                        }
                     />
                     <ToggleItem
                        label="Show timestamps"
                        value={settings.showTimestamps}
                        onChange={(value) =>
                           onSettingsChange({
                              ...settings,
                              showTimestamps: value,
                           })
                        }
                     />

                     <button
                        type="button"
                        onClick={onClearGuestData}
                        className="rounded-xl border border-(--app-input-border) px-4 py-2 text-sm text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                     >
                        Clear local guest data
                     </button>
                  </div>
               )}

               {activeTab === 'privacy' && (
                  <div className="space-y-4">
                     <div className="grid gap-2 sm:grid-cols-2">
                        <button
                           type="button"
                           disabled={
                              !currentUser || busyAction === 'export-json'
                           }
                           onClick={() =>
                              void runAction('export-json', async () => {
                                 await onExportJson();
                                 setStatusMessage('JSON export downloaded.');
                              })
                           }
                           className="flex items-center justify-center gap-2 rounded-xl border border-(--app-input-border) px-4 py-2 text-sm text-(--app-text-strong) hover:bg-[var(--app-soft-surface)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                           <Download className="h-4 w-4" />
                           Export JSON
                        </button>
                        <button
                           type="button"
                           disabled={
                              !currentUser || busyAction === 'export-csv'
                           }
                           onClick={() =>
                              void runAction('export-csv', async () => {
                                 await onExportCsv();
                                 setStatusMessage('CSV export downloaded.');
                              })
                           }
                           className="flex items-center justify-center gap-2 rounded-xl border border-(--app-input-border) px-4 py-2 text-sm text-(--app-text-strong) hover:bg-[var(--app-soft-surface)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                           <Download className="h-4 w-4" />
                           Export CSV
                        </button>
                     </div>

                     <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                        <p className="mb-2 font-semibold text-red-200">
                           Danger Zone
                        </p>
                        <div className="space-y-2">
                           <button
                              type="button"
                              disabled={
                                 !currentUser ||
                                 busyAction === 'delete-conversations'
                              }
                              onClick={() => {
                                 const confirmed = window.confirm(
                                    'Delete all conversations permanently? This cannot be undone.'
                                 );
                                 if (!confirmed) {
                                    return;
                                 }
                                 void runAction(
                                    'delete-conversations',
                                    async () => {
                                       await onDeleteConversations();
                                       setStatusMessage(
                                          'All conversations deleted.'
                                       );
                                    }
                                 );
                              }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 px-4 py-2 text-sm text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                           >
                              <Trash2 className="h-4 w-4" />
                              Delete all conversations
                           </button>
                           <button
                              type="button"
                              disabled={
                                 !currentUser || busyAction === 'delete-account'
                              }
                              onClick={() => {
                                 const confirmed = window.confirm(
                                    'Delete your account permanently? This will remove your chat data and account.'
                                 );
                                 if (!confirmed) {
                                    return;
                                 }
                                 void runAction('delete-account', async () => {
                                    await onDeleteAccount();
                                 });
                              }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 px-4 py-2 text-sm text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                           >
                              <UserRoundX className="h-4 w-4" />
                              Delete account
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'notifications' && (
                  <div className="space-y-4">
                     <ToggleItem
                        label="In-app notifications"
                        value={settings.inAppNotifications}
                        onChange={(value) =>
                           onSettingsChange({
                              ...settings,
                              inAppNotifications: value,
                           })
                        }
                     />
                     <ToggleItem
                        label="Sound on response"
                        value={settings.soundOnResponse}
                        onChange={(value) =>
                           onSettingsChange({
                              ...settings,
                              soundOnResponse: value,
                           })
                        }
                     />
                     <ToggleItem
                        label="Mute all notifications"
                        value={settings.muteAllNotifications}
                        onChange={(value) =>
                           onSettingsChange({
                              ...settings,
                              muteAllNotifications: value,
                           })
                        }
                     />
                  </div>
               )}

               {activeTab === 'usage' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                     <UsageCard
                        label="Questions asked today"
                        value={String(questionsToday)}
                     />
                     <UsageCard
                        label="Guest remaining"
                        value={
                           currentUser
                              ? 'Unlimited'
                              : String(Math.max(0, guestRemaining))
                        }
                     />
                     <UsageCard
                        label="Saved conversations"
                        value={String(historyCount)}
                     />
                     <UsageCard label="Plan" value="Free" />
                  </div>
               )}

               {activeTab === 'help' && (
                  <div className="space-y-2 text-sm">
                     <a
                        className="block rounded-xl border border-(--app-input-border) px-3 py-2 text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                        href="https://firebase.google.com/docs"
                        target="_blank"
                        rel="noreferrer"
                     >
                        FAQ
                     </a>
                     <a
                        className="block rounded-xl border border-(--app-input-border) px-3 py-2 text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                        href="mailto:support@assistly.app"
                     >
                        Contact Support
                     </a>
                     <a
                        className="block rounded-xl border border-(--app-input-border) px-3 py-2 text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                        href="https://policies.google.com/terms"
                        target="_blank"
                        rel="noreferrer"
                     >
                        Terms of Service
                     </a>
                     <a
                        className="block rounded-xl border border-(--app-input-border) px-3 py-2 text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                        href="https://policies.google.com/privacy"
                        target="_blank"
                        rel="noreferrer"
                     >
                        Privacy Policy
                     </a>
                     <p className="pt-2 text-xs text-(--app-text-muted)">
                        Version 1.0.0 - Environment: Local Development
                     </p>
                  </div>
               )}
            </section>
         </div>
      </div>
   );
}

function ToggleItem({
   label,
   value,
   onChange,
}: {
   label: string;
   value: boolean;
   onChange: (value: boolean) => void;
}) {
   return (
      <div className="flex items-center justify-between rounded-xl border border-(--app-input-border) px-3 py-2">
         <span className="text-sm text-(--app-text-strong)">{label}</span>
         <button
            type="button"
            onClick={() => onChange(!value)}
            className={`h-7 w-12 rounded-full p-1 transition ${
               value ? 'bg-indigo-500' : 'bg-[var(--app-soft-surface)]'
            }`}
         >
            <span
               className={`block h-5 w-5 rounded-full bg-white transition ${
                  value ? 'translate-x-5' : 'translate-x-0'
               }`}
            />
         </button>
      </div>
   );
}

function UsageCard({ label, value }: { label: string; value: string }) {
   return (
      <div className="rounded-2xl border border-(--app-input-border) bg-[var(--app-card-bg)] px-4 py-3">
         <p className="text-xs text-(--app-text-muted)">{label}</p>
         <p className="mt-1 text-lg font-semibold text-(--app-text-strong)">
            {value}
         </p>
      </div>
   );
}
