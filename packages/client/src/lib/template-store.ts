import type { AuthUser } from './auth-storage';

export type TemplateCategory =
   | 'Writing'
   | 'Coding'
   | 'Marketing'
   | 'Support'
   | 'General';

export type TemplateVisibility = 'private' | 'public';

export interface PromptTemplate {
   id: string;
   title: string;
   body: string;
   tags: string[];
   category: TemplateCategory;
   favorite: boolean;
   visibility: TemplateVisibility;
   version: number;
   usageCount: number;
   createdAt: string;
   updatedAt: string;
}

const TEMPLATE_STORE_PREFIX = 'assistly:templates';

export const templateCategories: TemplateCategory[] = [
   'Writing',
   'Coding',
   'Marketing',
   'Support',
   'General',
];

function storageKey(user: AuthUser | null) {
   return `${TEMPLATE_STORE_PREFIX}:${user?.uid || 'guest'}`;
}

function createId() {
   if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
   ) {
      return crypto.randomUUID();
   }
   return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
   return new Date().toISOString();
}

function defaultTemplates(): PromptTemplate[] {
   const now = nowIso();
   return [
      {
         id: createId(),
         title: 'Bug triage assistant',
         body: 'You are a senior engineer. Triage this bug report with root-cause hypotheses, repro steps, impact, and fix plan:\n\n{{bug_report}}',
         tags: ['debug', 'engineering'],
         category: 'Coding',
         favorite: true,
         visibility: 'private',
         version: 1,
         usageCount: 0,
         createdAt: now,
         updatedAt: now,
      },
      {
         id: createId(),
         title: 'Marketing campaign brief',
         body: 'Create a campaign brief for {{product}} targeting {{audience}}. Include message pillars, channels, timeline, and KPIs.',
         tags: ['campaign', 'kpi'],
         category: 'Marketing',
         favorite: false,
         visibility: 'private',
         version: 1,
         usageCount: 0,
         createdAt: now,
         updatedAt: now,
      },
      {
         id: createId(),
         title: 'Customer reply draft',
         body: 'Draft a polite and concise response to this customer message. Keep tone empathetic and solution-focused:\n\n{{message}}',
         tags: ['support', 'customer'],
         category: 'Support',
         favorite: false,
         visibility: 'private',
         version: 1,
         usageCount: 0,
         createdAt: now,
         updatedAt: now,
      },
   ];
}

function parseStoredTemplates(raw: string | null): PromptTemplate[] {
   if (!raw) {
      return [];
   }
   try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
         return [];
      }
      return parsed.filter(
         (item) => item && typeof item === 'object'
      ) as PromptTemplate[];
   } catch {
      return [];
   }
}

function persistTemplates(user: AuthUser | null, templates: PromptTemplate[]) {
   window.localStorage.setItem(storageKey(user), JSON.stringify(templates));
}

export function loadTemplates(user: AuthUser | null): PromptTemplate[] {
   const key = storageKey(user);
   const existing = parseStoredTemplates(window.localStorage.getItem(key));

   if (existing.length > 0) {
      return existing.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
   }

   const seeded = defaultTemplates();
   persistTemplates(user, seeded);
   return seeded;
}

export function createTemplate(
   user: AuthUser | null,
   payload: {
      title: string;
      body: string;
      tags: string[];
      category: TemplateCategory;
      visibility: TemplateVisibility;
   }
) {
   const templates = loadTemplates(user);
   const now = nowIso();
   const next: PromptTemplate = {
      id: createId(),
      title: payload.title.trim(),
      body: payload.body.trim(),
      tags: payload.tags,
      category: payload.category,
      visibility: payload.visibility,
      favorite: false,
      version: 1,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
   };
   const updated = [next, ...templates];
   persistTemplates(user, updated);
   return updated;
}

export function updateTemplate(
   user: AuthUser | null,
   templateId: string,
   payload: {
      title: string;
      body: string;
      tags: string[];
      category: TemplateCategory;
      visibility: TemplateVisibility;
   }
) {
   const templates = loadTemplates(user);
   const now = nowIso();
   const updated = templates.map((item) =>
      item.id === templateId
         ? {
              ...item,
              title: payload.title.trim(),
              body: payload.body.trim(),
              tags: payload.tags,
              category: payload.category,
              visibility: payload.visibility,
              version: item.version + 1,
              updatedAt: now,
           }
         : item
   );
   persistTemplates(user, updated);
   return updated;
}

export function deleteTemplate(user: AuthUser | null, templateId: string) {
   const templates = loadTemplates(user);
   const updated = templates.filter((item) => item.id !== templateId);
   persistTemplates(user, updated);
   return updated;
}

export function duplicateTemplate(user: AuthUser | null, templateId: string) {
   const templates = loadTemplates(user);
   const source = templates.find((item) => item.id === templateId);
   if (!source) {
      return templates;
   }
   const now = nowIso();
   const duplicated: PromptTemplate = {
      ...source,
      id: createId(),
      title: `${source.title} (Copy)`,
      favorite: false,
      version: 1,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
   };
   const updated = [duplicated, ...templates];
   persistTemplates(user, updated);
   return updated;
}

export function toggleFavoriteTemplate(
   user: AuthUser | null,
   templateId: string
) {
   const templates = loadTemplates(user);
   const now = nowIso();
   const updated = templates.map((item) =>
      item.id === templateId
         ? { ...item, favorite: !item.favorite, updatedAt: now }
         : item
   );
   persistTemplates(user, updated);
   return updated;
}

export function incrementTemplateUsage(
   user: AuthUser | null,
   templateId: string
) {
   const templates = loadTemplates(user);
   const now = nowIso();
   const updated = templates.map((item) =>
      item.id === templateId
         ? { ...item, usageCount: item.usageCount + 1, updatedAt: now }
         : item
   );
   persistTemplates(user, updated);
   return updated;
}
