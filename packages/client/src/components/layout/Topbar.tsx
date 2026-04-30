import { useState } from 'react';
import { Bell, Sun, Moon, ChevronDown, Menu } from 'lucide-react';
import type { ThemeMode } from '../../lib/app-settings';
import type { ProjectWorkspace } from '../../lib/project-workspaces';

interface TopbarProps {
   onMenuClick?: () => void;
   themeMode: ThemeMode;
   onCycleTheme: () => void;
   inAppNotifications: boolean;
   muteAllNotifications: boolean;
   onOpenSettings: () => void;
   projects: ProjectWorkspace[];
   selectedProjectId: string | null;
   onSelectProject: (projectId: string | null) => void;
   onOpenProjects: () => void;
}

export function Topbar({
   onMenuClick,
   themeMode,
   onCycleTheme,
   inAppNotifications,
   muteAllNotifications,
   onOpenSettings,
   projects,
   selectedProjectId,
   onSelectProject,
   onOpenProjects,
}: TopbarProps) {
   const [dropdownOpen, setDropdownOpen] = useState(false);
   const [notificationsOpen, setNotificationsOpen] = useState(false);

   const handleDropdown = () => setDropdownOpen((v) => !v);
   const handleNotifications = () => setNotificationsOpen((v) => !v);

   const activeProject = selectedProjectId
      ? projects.find((item) => item.id === selectedProjectId) || null
      : null;
   const activeProjectLabel = activeProject?.name || 'Messaging app';

   return (
      <header className="relative flex h-16 items-center justify-between border-b border-[var(--app-divider)] bg-[var(--app-header-bg)] px-4 sm:px-6 md:px-8">
         {/* App Title and Dropdown */}
         <div className="relative flex items-center gap-2 sm:gap-3">
            <button
               type="button"
               className="rounded-lg p-2 transition hover:bg-[var(--app-soft-surface)] lg:hidden"
               onClick={onMenuClick}
               aria-label="Open sidebar"
            >
               <Menu className="h-5 w-5 text-(--app-text-muted)" />
            </button>
            <span className="max-w-[170px] truncate text-base font-semibold text-(--app-text-strong) sm:max-w-none sm:text-lg">
               {activeProjectLabel}
            </span>
            <button
               className="ml-2 flex items-center gap-1 rounded-lg bg-[var(--app-soft-surface)] px-2 py-1 text-sm text-(--app-text-muted)"
               onClick={handleDropdown}
               aria-expanded={dropdownOpen}
            >
               <ChevronDown
                  className={
                     dropdownOpen
                        ? 'w-4 h-4 rotate-180 transition'
                        : 'w-4 h-4 transition'
                  }
               />
            </button>
            {dropdownOpen && (
               <div className="absolute left-0 top-12 z-20 min-w-[180px] rounded-xl bg-[var(--app-soft-surface)] px-4 py-2 text-(--app-text-strong) shadow-lg">
                  <button
                     type="button"
                     className={`w-full cursor-pointer rounded px-2 py-1 text-left hover:bg-[var(--app-card-bg)] ${
                        selectedProjectId === null ? 'text-indigo-300' : ''
                     }`}
                     onClick={() => {
                        onSelectProject(null);
                        setDropdownOpen(false);
                     }}
                  >
                     New Chat (No project)
                  </button>
                  {projects
                     .filter((item) => !item.archived)
                     .slice(0, 8)
                     .map((project) => (
                        <button
                           key={project.id}
                           type="button"
                           className={`w-full cursor-pointer rounded px-2 py-1 text-left hover:bg-[var(--app-card-bg)] ${
                              selectedProjectId === project.id
                                 ? 'text-indigo-300'
                                 : ''
                           }`}
                           onClick={() => {
                              onSelectProject(project.id);
                              setDropdownOpen(false);
                           }}
                        >
                           {project.name}
                        </button>
                     ))}
                  <button
                     type="button"
                     className="w-full cursor-pointer rounded px-2 py-1 text-left hover:bg-[var(--app-card-bg)]"
                     onClick={() => {
                        onOpenProjects();
                        setDropdownOpen(false);
                     }}
                  >
                     Manage Projects
                  </button>
                  <button
                     type="button"
                     className="w-full cursor-pointer rounded px-2 py-1 text-left hover:bg-[var(--app-card-bg)]"
                     onClick={() => {
                        setDropdownOpen(false);
                        onOpenSettings();
                     }}
                  >
                     Settings
                  </button>
               </div>
            )}
         </div>
         {/* Actions */}
         <div className="relative flex items-center gap-2 sm:gap-4">
            <button
               className="relative rounded-full bg-[var(--app-soft-surface)] p-2 transition hover:opacity-85"
               onClick={handleNotifications}
               aria-expanded={notificationsOpen}
            >
               <Bell className="h-5 w-5 text-(--app-text-muted)" />
               {inAppNotifications && !muteAllNotifications && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-indigo-500" />
               )}
            </button>
            {notificationsOpen && (
               <div className="absolute right-0 top-12 z-20 min-w-[220px] rounded-xl bg-[var(--app-soft-surface)] px-4 py-2 text-(--app-text-strong) shadow-lg">
                  <div className="px-2 py-1 text-sm text-(--app-text-muted)">
                     {inAppNotifications && !muteAllNotifications
                        ? 'No new notifications'
                        : 'Notifications are muted. Enable them in settings.'}
                  </div>
               </div>
            )}
            <button
               className="rounded-full bg-[var(--app-soft-surface)] p-2 transition hover:opacity-85"
               onClick={onCycleTheme}
               aria-pressed={themeMode === 'light'}
               title={`Theme: ${themeMode}`}
            >
               {themeMode === 'light' ? (
                  <Moon className="w-5 h-5 text-[#4f59e8]" />
               ) : (
                  <Sun className="w-5 h-5 text-yellow-400" />
               )}
            </button>
            <button
               type="button"
               onClick={onOpenSettings}
               className="rounded-full bg-[var(--app-soft-surface)] px-3 py-2 text-xs font-medium text-(--app-text-muted) transition hover:opacity-85"
            >
               Settings
            </button>
         </div>
      </header>
   );
}
