import {
   addDoc,
   collection,
   deleteDoc,
   doc,
   getDoc,
   getDocs,
   serverTimestamp,
   setDoc,
   type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

export interface ProjectWorkspace {
   id: string;
   name: string;
   description: string;
   context: string;
   links: string[];
   docs: string[];
   owner: string;
   collaborators: string[];
   archived: boolean;
   createdAt: string | null;
   updatedAt: string | null;
}

interface WorkspacePayload {
   name: string;
   description?: string;
   context?: string;
   links?: string[];
   docs?: string[];
   owner?: string;
   collaborators?: string[];
}

function projectsCollection(uid: string) {
   return collection(db, 'users', uid, 'projects');
}

function projectDoc(uid: string, projectId: string) {
   return doc(db, 'users', uid, 'projects', projectId);
}

function toIsoTimestamp(value: unknown): string | null {
   if (!value) {
      return null;
   }
   if (value instanceof Date) {
      return value.toISOString();
   }
   if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof value.toDate === 'function'
   ) {
      const asDate = value.toDate();
      return asDate instanceof Date ? asDate.toISOString() : null;
   }
   return null;
}

function normalizeStringArray(values: string[] | undefined) {
   if (!values) {
      return [];
   }
   const unique = new Set(
      values.map((item) => item.trim()).filter((item) => item.length > 0)
   );
   return [...unique];
}

function mapProject(id: string, data: DocumentData): ProjectWorkspace {
   return {
      id,
      name: String(data.name || 'Untitled project'),
      description: String(data.description || ''),
      context: String(data.context || ''),
      links: Array.isArray(data.links)
         ? data.links.filter((item: unknown) => typeof item === 'string')
         : [],
      docs: Array.isArray(data.docs)
         ? data.docs.filter((item: unknown) => typeof item === 'string')
         : [],
      owner: String(data.owner || ''),
      collaborators: Array.isArray(data.collaborators)
         ? data.collaborators.filter(
              (item: unknown) => typeof item === 'string'
           )
         : [],
      archived: Boolean(data.archived),
      createdAt: toIsoTimestamp(data.createdAt),
      updatedAt: toIsoTimestamp(data.updatedAt),
   };
}

export async function listProjectWorkspaces(
   uid: string,
   includeArchived = true
): Promise<ProjectWorkspace[]> {
   const snapshot = await getDocs(projectsCollection(uid));
   const projects = snapshot.docs.map((item) =>
      mapProject(item.id, item.data())
   );
   const filtered = includeArchived
      ? projects
      : projects.filter((item) => !item.archived);

   return filtered.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
   });
}

export async function createProjectWorkspace(
   uid: string,
   payload: WorkspacePayload
): Promise<ProjectWorkspace> {
   const now = serverTimestamp();
   const docRef = await addDoc(projectsCollection(uid), {
      name: payload.name.trim() || 'Untitled project',
      description: payload.description?.trim() || '',
      context: payload.context?.trim() || '',
      links: normalizeStringArray(payload.links),
      docs: normalizeStringArray(payload.docs),
      owner: payload.owner?.trim() || '',
      collaborators: normalizeStringArray(payload.collaborators),
      archived: false,
      createdAt: now,
      updatedAt: now,
   });

   const created = await getDoc(docRef);
   return mapProject(created.id, created.data() || {});
}

export async function updateProjectWorkspace(
   uid: string,
   projectId: string,
   payload: Partial<WorkspacePayload>
): Promise<void> {
   await setDoc(
      projectDoc(uid, projectId),
      {
         ...(payload.name !== undefined
            ? { name: payload.name.trim() || 'Untitled project' }
            : {}),
         ...(payload.description !== undefined
            ? { description: payload.description.trim() }
            : {}),
         ...(payload.context !== undefined
            ? { context: payload.context.trim() }
            : {}),
         ...(payload.links !== undefined
            ? { links: normalizeStringArray(payload.links) }
            : {}),
         ...(payload.docs !== undefined
            ? { docs: normalizeStringArray(payload.docs) }
            : {}),
         ...(payload.owner !== undefined
            ? { owner: payload.owner.trim() }
            : {}),
         ...(payload.collaborators !== undefined
            ? { collaborators: normalizeStringArray(payload.collaborators) }
            : {}),
         updatedAt: serverTimestamp(),
      },
      { merge: true }
   );
}

export async function archiveProjectWorkspace(
   uid: string,
   projectId: string,
   archived: boolean
): Promise<void> {
   await setDoc(
      projectDoc(uid, projectId),
      {
         archived,
         updatedAt: serverTimestamp(),
      },
      { merge: true }
   );
}

export async function duplicateProjectWorkspace(
   uid: string,
   projectId: string
): Promise<ProjectWorkspace | null> {
   const sourceSnapshot = await getDoc(projectDoc(uid, projectId));
   if (!sourceSnapshot.exists()) {
      return null;
   }

   const source = mapProject(sourceSnapshot.id, sourceSnapshot.data());
   return createProjectWorkspace(uid, {
      name: `${source.name} (Copy)`,
      description: source.description,
      context: source.context,
      links: source.links,
      docs: source.docs,
      owner: source.owner,
      collaborators: source.collaborators,
   });
}

export async function deleteProjectWorkspace(
   uid: string,
   projectId: string
): Promise<void> {
   await deleteDoc(projectDoc(uid, projectId));
}
