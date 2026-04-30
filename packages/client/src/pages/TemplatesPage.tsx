import { useMemo, useState } from 'react';
import {
   Copy,
   Pencil,
   Plus,
   Search,
   Star,
   Trash2,
   WandSparkles,
} from 'lucide-react';
import type { AuthUser } from '../lib/auth-storage';
import {
   createTemplate,
   deleteTemplate,
   duplicateTemplate,
   incrementTemplateUsage,
   templateCategories,
   toggleFavoriteTemplate,
   updateTemplate,
   type PromptTemplate,
   type TemplateCategory,
   type TemplateVisibility,
} from '../lib/template-store';

interface TemplatesPageProps {
   currentUser: AuthUser | null;
   templates: PromptTemplate[];
   onTemplatesChange: (templates: PromptTemplate[]) => void;
   onUseTemplate: (template: PromptTemplate) => void;
}

interface FormState {
   title: string;
   body: string;
   tags: string;
   category: TemplateCategory;
   visibility: TemplateVisibility;
}

const emptyForm: FormState = {
   title: '',
   body: '',
   tags: '',
   category: 'General',
   visibility: 'private',
};

export function TemplatesPage({
   currentUser,
   templates,
   onTemplatesChange,
   onUseTemplate,
}: TemplatesPageProps) {
   const [query, setQuery] = useState('');
   const [categoryFilter, setCategoryFilter] = useState<
      'All' | TemplateCategory
   >('All');
   const [favoritesOnly, setFavoritesOnly] = useState(false);
   const [formOpen, setFormOpen] = useState(false);
   const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
      null
   );
   const [form, setForm] = useState<FormState>(emptyForm);

   const filteredTemplates = useMemo(() => {
      const normalizedQuery = query.trim().toLowerCase();
      return templates.filter((item) => {
         if (favoritesOnly && !item.favorite) {
            return false;
         }
         if (categoryFilter !== 'All' && item.category !== categoryFilter) {
            return false;
         }
         if (!normalizedQuery) {
            return true;
         }
         const bag = [
            item.title,
            item.body,
            item.category,
            item.tags.join(' '),
            item.visibility,
         ]
            .join(' ')
            .toLowerCase();
         return bag.includes(normalizedQuery);
      });
   }, [categoryFilter, favoritesOnly, query, templates]);

   const openCreate = () => {
      setEditingTemplateId(null);
      setForm(emptyForm);
      setFormOpen(true);
   };

   const openEdit = (template: PromptTemplate) => {
      setEditingTemplateId(template.id);
      setForm({
         title: template.title,
         body: template.body,
         tags: template.tags.join(', '),
         category: template.category,
         visibility: template.visibility,
      });
      setFormOpen(true);
   };

   const handleSubmit = () => {
      if (!form.title.trim() || !form.body.trim()) {
         return;
      }

      const normalizedTags = form.tags
         .split(',')
         .map((item) => item.trim())
         .filter(Boolean);

      const nextTemplates = editingTemplateId
         ? updateTemplate(currentUser, editingTemplateId, {
              title: form.title,
              body: form.body,
              tags: normalizedTags,
              category: form.category,
              visibility: form.visibility,
           })
         : createTemplate(currentUser, {
              title: form.title,
              body: form.body,
              tags: normalizedTags,
              category: form.category,
              visibility: form.visibility,
           });

      onTemplatesChange(nextTemplates);
      setFormOpen(false);
      setEditingTemplateId(null);
      setForm(emptyForm);
   };

   return (
      <section className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-[var(--app-divider)] bg-[var(--app-header-bg)] p-4 sm:p-6">
         <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
               <h1 className="text-xl font-semibold text-(--app-text-strong)">
                  Templates Library
               </h1>
               <p className="text-sm text-(--app-text-muted)">
                  Save prompt workflows and reuse them in chat instantly.
               </p>
            </div>
            <button
               type="button"
               onClick={openCreate}
               className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
            >
               <Plus className="h-4 w-4" />
               Create Template
            </button>
         </div>

         <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <label className="relative">
               <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-(--app-text-muted)" />
               <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] py-2 pl-9 pr-3 text-sm text-(--app-text-strong) outline-none"
               />
            </label>

            <select
               value={categoryFilter}
               onChange={(e) =>
                  setCategoryFilter(e.target.value as 'All' | TemplateCategory)
               }
               className="rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
            >
               <option value="All">All categories</option>
               {templateCategories.map((item) => (
                  <option key={item} value={item}>
                     {item}
                  </option>
               ))}
            </select>

            <button
               type="button"
               onClick={() => setFavoritesOnly((prev) => !prev)}
               className={`rounded-xl px-3 py-2 text-sm transition ${
                  favoritesOnly
                     ? 'bg-amber-500/20 text-amber-300'
                     : 'bg-[var(--app-soft-surface)] text-(--app-text-muted)'
               }`}
            >
               Favorites
            </button>
         </div>

         <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((item) => (
               <article
                  key={item.id}
                  className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4"
               >
                  <div className="mb-2 flex items-start justify-between gap-2">
                     <div>
                        <h3 className="line-clamp-1 font-semibold text-(--app-text-strong)">
                           {item.title}
                        </h3>
                        <p className="text-xs text-(--app-text-muted)">
                           {item.category} · v{item.version} · used{' '}
                           {item.usageCount} times
                        </p>
                     </div>
                     <button
                        type="button"
                        onClick={() =>
                           onTemplatesChange(
                              toggleFavoriteTemplate(currentUser, item.id)
                           )
                        }
                        className="rounded-lg p-1 text-(--app-text-muted) hover:bg-[var(--app-soft-surface)]"
                     >
                        <Star
                           className={`h-4 w-4 ${
                              item.favorite
                                 ? 'fill-amber-400 text-amber-400'
                                 : ''
                           }`}
                        />
                     </button>
                  </div>

                  <p className="mb-3 line-clamp-4 text-sm text-(--app-text-muted)">
                     {item.body}
                  </p>

                  <div className="mb-3 flex flex-wrap gap-1">
                     {item.tags.map((tag) => (
                        <span
                           key={tag}
                           className="rounded-full bg-[var(--app-soft-surface)] px-2 py-0.5 text-[11px] text-(--app-text-muted)"
                        >
                           #{tag}
                        </span>
                     ))}
                     <span className="rounded-full bg-[var(--app-soft-surface)] px-2 py-0.5 text-[11px] text-(--app-text-muted)">
                        {item.visibility}
                     </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                     <button
                        type="button"
                        onClick={() => {
                           onTemplatesChange(
                              incrementTemplateUsage(currentUser, item.id)
                           );
                           onUseTemplate(item);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
                     >
                        <WandSparkles className="h-3.5 w-3.5" />
                        Use Template
                     </button>
                     <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--app-input-border) px-3 py-2 text-xs text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                     >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                     </button>
                     <button
                        type="button"
                        onClick={() =>
                           onTemplatesChange(
                              duplicateTemplate(currentUser, item.id)
                           )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--app-input-border) px-3 py-2 text-xs text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                     >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicate
                     </button>
                     <button
                        type="button"
                        onClick={() => {
                           const confirmed = window.confirm(
                              `Delete template "${item.title}"?`
                           );
                           if (!confirmed) {
                              return;
                           }
                           onTemplatesChange(
                              deleteTemplate(currentUser, item.id)
                           );
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10"
                     >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                     </button>
                  </div>
               </article>
            ))}
         </div>

         {filteredTemplates.length === 0 && (
            <div className="mt-8 rounded-2xl border border-dashed border-[var(--app-divider)] p-6 text-center text-sm text-(--app-text-muted)">
               No templates found for this filter. Try a different search or
               create one.
            </div>
         )}

         {formOpen && (
            <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/50 p-4">
               <div className="w-full max-w-2xl rounded-3xl border border-[var(--app-divider)] bg-[var(--app-shell-bg)] p-5">
                  <h2 className="mb-4 text-lg font-semibold text-(--app-text-strong)">
                     {editingTemplateId ? 'Edit Template' : 'Create Template'}
                  </h2>

                  <div className="space-y-3">
                     <input
                        value={form.title}
                        onChange={(e) =>
                           setForm((current) => ({
                              ...current,
                              title: e.target.value,
                           }))
                        }
                        placeholder="Template title"
                        className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                     />
                     <textarea
                        value={form.body}
                        onChange={(e) =>
                           setForm((current) => ({
                              ...current,
                              body: e.target.value,
                           }))
                        }
                        placeholder="Template prompt body"
                        className="min-h-44 w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                     />
                     <input
                        value={form.tags}
                        onChange={(e) =>
                           setForm((current) => ({
                              ...current,
                              tags: e.target.value,
                           }))
                        }
                        placeholder="Tags, separated by commas"
                        className="w-full rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                     />

                     <div className="grid gap-2 sm:grid-cols-2">
                        <select
                           value={form.category}
                           onChange={(e) =>
                              setForm((current) => ({
                                 ...current,
                                 category: e.target.value as TemplateCategory,
                              }))
                           }
                           className="rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                        >
                           {templateCategories.map((item) => (
                              <option key={item} value={item}>
                                 {item}
                              </option>
                           ))}
                        </select>
                        <select
                           value={form.visibility}
                           onChange={(e) =>
                              setForm((current) => ({
                                 ...current,
                                 visibility: e.target
                                    .value as TemplateVisibility,
                              }))
                           }
                           className="rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong) outline-none"
                        >
                           <option value="private">Private</option>
                           <option value="public">Public</option>
                        </select>
                     </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                     <button
                        type="button"
                        onClick={() => setFormOpen(false)}
                        className="rounded-xl border border-(--app-input-border) px-4 py-2 text-sm text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                     >
                        Cancel
                     </button>
                     <button
                        type="button"
                        onClick={handleSubmit}
                        className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
                     >
                        {editingTemplateId ? 'Save Changes' : 'Create Template'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </section>
   );
}
