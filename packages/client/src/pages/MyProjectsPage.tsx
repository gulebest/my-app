import { useMemo, useState } from 'react';
import {
   Archive,
   Copy,
   Folder,
   FolderOpen,
   Pencil,
   Plus,
   Trash2,
   Users,
} from 'lucide-react';
import type { ProjectWorkspace } from '../lib/project-workspaces';

interface ProjectSummary {
   conversationCount: number;
   lastConversationAt: string | null;
}

interface MyProjectsPageProps {
   canManageProjects: boolean;
   projects: ProjectWorkspace[];
   selectedProjectId: string | null;
   summariesByProjectId: Record<string, ProjectSummary>;
   permissionBlocked?: boolean;
   errorMessage?: string | null;
   onOpenProject: (projectId: string) => void;
   onCreateProject: (payload: {
      name: string;
      description: string;
      context: string;
      links: string[];
      docs: string[];
      owner: string;
      collaborators: string[];
   }) => Promise<void>;
   onRenameProject: (projectId: string, name: string) => Promise<void>;
   onEditProject: (
      projectId: string,
      payload: {
         description: string;
         context: string;
         links: string[];
         docs: string[];
         owner: string;
         collaborators: string[];
      }
   ) => Promise<void>;
   onDuplicateProject: (projectId: string) => Promise<void>;
   onArchiveProject: (projectId: string, archived: boolean) => Promise<void>;
   onDeleteProject: (projectId: string) => Promise<void>;
}

interface ProjectFormState {
   name: string;
   description: string;
   context: string;
   linksText: string;
   docsText: string;
   owner: string;
   collaboratorsText: string;
}

const emptyForm: ProjectFormState = {
   name: '',
   description: '',
   context: '',
   linksText: '',
   docsText: '',
   owner: '',
   collaboratorsText: '',
};

function linesToList(raw: string) {
   return raw
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
}

function formatDate(value: string | null) {
   if (!value) {
      return 'No activity yet';
   }
   const date = new Date(value);
   if (Number.isNaN(date.getTime())) {
      return 'No activity yet';
   }
   return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
   });
}

export function MyProjectsPage({
   canManageProjects,
   projects,
   selectedProjectId,
   summariesByProjectId,
   permissionBlocked = false,
   errorMessage = null,
   onOpenProject,
   onCreateProject,
   onRenameProject,
   onEditProject,
   onDuplicateProject,
   onArchiveProject,
   onDeleteProject,
}: MyProjectsPageProps) {
   const [showArchived, setShowArchived] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');
   const [isCreateOpen, setIsCreateOpen] = useState(false);
   const [editingProject, setEditingProject] =
      useState<ProjectWorkspace | null>(null);
   const [form, setForm] = useState<ProjectFormState>(emptyForm);
   const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [formError, setFormError] = useState<string | null>(null);

   const visibleProjects = useMemo(() => {
      const normalized = searchTerm.trim().toLowerCase();
      return projects.filter((item) => {
         if (!showArchived && item.archived) {
            return false;
         }
         if (!normalized) {
            return true;
         }
         const searchable = [
            item.name,
            item.description,
            item.owner,
            item.collaborators.join(' '),
         ]
            .join(' ')
            .toLowerCase();
         return searchable.includes(normalized);
      });
   }, [projects, searchTerm, showArchived]);

   const openCreateModal = () => {
      if (permissionBlocked) {
         return;
      }
      setForm(emptyForm);
      setEditingProject(null);
      setIsCreateOpen(true);
      setFormError(null);
   };

   const openEditModal = (project: ProjectWorkspace) => {
      setForm({
         name: project.name,
         description: project.description,
         context: project.context,
         linksText: project.links.join('\n'),
         docsText: project.docs.join('\n'),
         owner: project.owner,
         collaboratorsText: project.collaborators.join('\n'),
      });
      setEditingProject(project);
      setIsCreateOpen(true);
      setFormError(null);
   };

   const closeModal = () => {
      setIsCreateOpen(false);
      setEditingProject(null);
      setForm(emptyForm);
      setFormError(null);
   };

   const submitForm = async () => {
      if (!form.name.trim()) {
         return;
      }

      setIsSubmitting(true);
      try {
         const payload = {
            name: form.name,
            description: form.description,
            context: form.context,
            links: linesToList(form.linksText),
            docs: linesToList(form.docsText),
            owner: form.owner,
            collaborators: linesToList(form.collaboratorsText),
         };

         if (editingProject) {
            await onRenameProject(editingProject.id, payload.name);
            await onEditProject(editingProject.id, {
               description: payload.description,
               context: payload.context,
               links: payload.links,
               docs: payload.docs,
               owner: payload.owner,
               collaborators: payload.collaborators,
            });
         } else {
            await onCreateProject(payload);
         }
         closeModal();
      } catch (error) {
         setFormError(
            error instanceof Error
               ? error.message
               : 'Unable to save project changes right now.'
         );
      } finally {
         setIsSubmitting(false);
      }
   };

   if (!canManageProjects) {
      return (
         <section className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-[var(--app-divider)] bg-[var(--app-header-bg)] p-6">
            <div className="max-w-md text-center">
               <h2 className="text-xl font-semibold text-(--app-text-strong)">
                  Sign in to manage projects
               </h2>
               <p className="mt-2 text-sm text-(--app-text-muted)">
                  Projects are saved per account. Sign in or create an account
                  to create workspaces and attach chat history to them.
               </p>
            </div>
         </section>
      );
   }

   return (
      <section className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-[var(--app-divider)] bg-[var(--app-header-bg)] p-4 sm:p-6">
         <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
               <h1 className="text-xl font-semibold text-(--app-text-strong)">
                  My Projects
               </h1>
               <p className="text-sm text-(--app-text-muted)">
                  Create project workspaces and keep chats/template runs scoped
                  to each project.
               </p>
            </div>
            <button
               type="button"
               onClick={openCreateModal}
               disabled={permissionBlocked}
               className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
            >
               <Plus className="h-4 w-4" />
               New Project
            </button>
         </div>

         {(permissionBlocked || errorMessage) && (
            <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
               {errorMessage ||
                  'Project workspace access is blocked by Firestore security rules.'}
            </div>
         )}

         <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
               value={searchTerm}
               onChange={(event) => setSearchTerm(event.target.value)}
               placeholder="Search projects..."
               className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
            />
            <button
               type="button"
               onClick={() => setShowArchived((value) => !value)}
               className="rounded-xl border border-(--app-input-border) bg-[var(--app-soft-surface)] px-3 py-2 text-sm text-(--app-text-strong) hover:opacity-90"
            >
               {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
         </div>

         <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleProjects.map((project) => {
               const summary = summariesByProjectId[project.id];
               const count = summary?.conversationCount || 0;
               const lastUpdated =
                  summary?.lastConversationAt ||
                  project.updatedAt ||
                  project.createdAt ||
                  null;

               return (
                  <article
                     key={project.id}
                     className={`rounded-2xl border p-4 ${
                        selectedProjectId === project.id
                           ? 'border-indigo-400 bg-indigo-500/10'
                           : 'border-[var(--app-card-border)] bg-[var(--app-card-bg)]'
                     }`}
                  >
                     <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                           <h3 className="truncate text-base font-semibold text-(--app-text-strong)">
                              {project.name}
                           </h3>
                           <p className="text-xs text-(--app-text-muted)">
                              {project.archived ? 'Archived' : 'Active'} |{' '}
                              {count} conversations
                           </p>
                        </div>
                        <Folder className="h-4 w-4 text-(--app-text-muted)" />
                     </div>

                     <p className="mb-3 line-clamp-2 text-sm text-(--app-text-muted)">
                        {project.description || 'No description added yet.'}
                     </p>

                     <div className="mb-3 text-xs text-(--app-text-muted)">
                        Last updated: {formatDate(lastUpdated)}
                     </div>

                     <div className="mb-3 flex items-center gap-2 text-xs text-(--app-text-muted)">
                        <Users className="h-3.5 w-3.5" />
                        <span className="truncate">
                           Owner: {project.owner || 'Not set'} | Collaborators:{' '}
                           {project.collaborators.length}
                        </span>
                     </div>

                     <div className="grid grid-cols-2 gap-2">
                        <button
                           type="button"
                           onClick={() => onOpenProject(project.id)}
                           disabled={permissionBlocked}
                           className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
                        >
                           <FolderOpen className="h-3.5 w-3.5" />
                           Open
                        </button>
                        <button
                           type="button"
                           onClick={() => openEditModal(project)}
                           disabled={permissionBlocked}
                           className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--app-input-border) px-3 py-2 text-xs text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                        >
                           <Pencil className="h-3.5 w-3.5" />
                           Rename
                        </button>
                        <button
                           type="button"
                           onClick={async () => {
                              setBusyProjectId(project.id);
                              try {
                                 await onDuplicateProject(project.id);
                              } finally {
                                 setBusyProjectId(null);
                              }
                           }}
                           disabled={
                              permissionBlocked || busyProjectId === project.id
                           }
                           className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--app-input-border) px-3 py-2 text-xs text-(--app-text-strong) hover:bg-[var(--app-soft-surface)] disabled:opacity-60"
                        >
                           <Copy className="h-3.5 w-3.5" />
                           Duplicate
                        </button>
                        <button
                           type="button"
                           onClick={async () => {
                              setBusyProjectId(project.id);
                              try {
                                 await onArchiveProject(
                                    project.id,
                                    !project.archived
                                 );
                              } finally {
                                 setBusyProjectId(null);
                              }
                           }}
                           disabled={
                              permissionBlocked || busyProjectId === project.id
                           }
                           className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--app-input-border) px-3 py-2 text-xs text-(--app-text-strong) hover:bg-[var(--app-soft-surface)] disabled:opacity-60"
                        >
                           <Archive className="h-3.5 w-3.5" />
                           {project.archived ? 'Unarchive' : 'Archive'}
                        </button>
                        <button
                           type="button"
                           onClick={async () => {
                              const confirmed = window.confirm(
                                 `Delete "${project.name}"? This does not delete previous chats.`
                              );
                              if (!confirmed) {
                                 return;
                              }

                              setBusyProjectId(project.id);
                              try {
                                 await onDeleteProject(project.id);
                              } finally {
                                 setBusyProjectId(null);
                              }
                           }}
                           disabled={
                              permissionBlocked || busyProjectId === project.id
                           }
                           className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                        >
                           <Trash2 className="h-3.5 w-3.5" />
                           Delete
                        </button>
                     </div>
                  </article>
               );
            })}
         </div>

         {visibleProjects.length === 0 && (
            <div className="mt-8 rounded-2xl border border-dashed border-[var(--app-divider)] p-6 text-center text-sm text-(--app-text-muted)">
               No projects found. Create your first project workspace.
            </div>
         )}

         {isCreateOpen && (
            <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/50 p-4">
               <div className="app-scroll max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--app-divider)] bg-[var(--app-shell-bg)] p-5">
                  <h2 className="mb-4 text-lg font-semibold text-(--app-text-strong)">
                     {editingProject ? 'Edit Project' : 'Create Project'}
                  </h2>

                  <div className="space-y-3">
                     {formError && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                           {formError}
                        </div>
                     )}
                     <input
                        value={form.name}
                        onChange={(event) =>
                           setForm((current) => ({
                              ...current,
                              name: event.target.value,
                           }))
                        }
                        placeholder="Project name"
                        className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                     />
                     <textarea
                        value={form.description}
                        onChange={(event) =>
                           setForm((current) => ({
                              ...current,
                              description: event.target.value,
                           }))
                        }
                        placeholder="Project description"
                        className="min-h-24 w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                     />
                     <textarea
                        value={form.context}
                        onChange={(event) =>
                           setForm((current) => ({
                              ...current,
                              context: event.target.value,
                           }))
                        }
                        placeholder="Context to keep in mind for this project"
                        className="min-h-28 w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                     />
                     <div className="grid gap-3 md:grid-cols-2">
                        <textarea
                           value={form.linksText}
                           onChange={(event) =>
                              setForm((current) => ({
                                 ...current,
                                 linksText: event.target.value,
                              }))
                           }
                           placeholder="Links (one per line)"
                           className="min-h-28 w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                        />
                        <textarea
                           value={form.docsText}
                           onChange={(event) =>
                              setForm((current) => ({
                                 ...current,
                                 docsText: event.target.value,
                              }))
                           }
                           placeholder="Docs/refs (one per line)"
                           className="min-h-28 w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                        />
                     </div>
                     <div className="grid gap-3 md:grid-cols-2">
                        <input
                           value={form.owner}
                           onChange={(event) =>
                              setForm((current) => ({
                                 ...current,
                                 owner: event.target.value,
                              }))
                           }
                           placeholder="Owner"
                           className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                        />
                        <textarea
                           value={form.collaboratorsText}
                           onChange={(event) =>
                              setForm((current) => ({
                                 ...current,
                                 collaboratorsText: event.target.value,
                              }))
                           }
                           placeholder="Collaborators (one per line)"
                           className="min-h-20 w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                        />
                     </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                     <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-xl border border-(--app-input-border) px-4 py-2 text-sm text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                     >
                        Cancel
                     </button>
                     <button
                        type="button"
                        onClick={submitForm}
                        disabled={
                           permissionBlocked ||
                           isSubmitting ||
                           !form.name.trim()
                        }
                        className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                     >
                        {editingProject ? 'Save Changes' : 'Create Project'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </section>
   );
}
