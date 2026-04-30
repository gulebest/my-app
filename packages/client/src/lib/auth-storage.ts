import {
   createUserWithEmailAndPassword,
   onAuthStateChanged,
   signInWithEmailAndPassword,
   signOut as firebaseSignOut,
   updateProfile,
   type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { isFirestorePermissionDenied } from './firebase-errors';

export interface AuthUser {
   uid: string;
   fullName: string;
   email: string;
}

function normalizeEmail(email: string) {
   return email.trim().toLowerCase();
}

async function ensureUserProfile(user: User, fullNameOverride?: string) {
   const fallbackProfile = {
      uid: user.uid,
      fullName:
         fullNameOverride?.trim() ||
         user.displayName?.trim() ||
         user.email?.split('@')[0] ||
         'User',
      email: normalizeEmail(user.email || ''),
   } satisfies AuthUser;

   try {
      const userRef = doc(db, 'users', user.uid);
      const snapshot = await getDoc(userRef);

      const resolvedName =
         fullNameOverride?.trim() ||
         user.displayName?.trim() ||
         snapshot.data()?.fullName ||
         fallbackProfile.fullName;

      const resolvedEmail = normalizeEmail(
         user.email || snapshot.data()?.email || fallbackProfile.email
      );

      const baseData = {
         fullName: resolvedName,
         email: resolvedEmail,
         updatedAt: serverTimestamp(),
      };

      if (!snapshot.exists()) {
         await setDoc(userRef, {
            ...baseData,
            createdAt: serverTimestamp(),
         });
      } else {
         await setDoc(userRef, baseData, { merge: true });
      }

      return {
         uid: user.uid,
         fullName: resolvedName,
         email: resolvedEmail,
      } satisfies AuthUser;
   } catch (error) {
      if (!isFirestorePermissionDenied(error)) {
         console.warn(
            'Firestore profile sync unavailable, using auth profile only.',
            error
         );
      }
      return fallbackProfile;
   }
}

export async function createAccount(payload: {
   fullName: string;
   email: string;
   password: string;
}) {
   const fullName = payload.fullName.trim();
   const email = normalizeEmail(payload.email);
   const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      payload.password
   );

   await updateProfile(credential.user, { displayName: fullName });
   return ensureUserProfile(credential.user, fullName);
}

export async function signIn(payload: { email: string; password: string }) {
   const email = normalizeEmail(payload.email);
   const credential = await signInWithEmailAndPassword(
      auth,
      email,
      payload.password
   );
   return ensureUserProfile(credential.user);
}

export async function signOut() {
   await firebaseSignOut(auth);
}

export async function updateAccountProfile(payload: { fullName: string }) {
   const user = auth.currentUser;
   if (!user) {
      throw new Error('No active session');
   }

   const fullName = payload.fullName.trim();
   if (!fullName) {
      throw new Error('Full name is required');
   }

   await updateProfile(user, { displayName: fullName });
   return ensureUserProfile(user, fullName);
}

export function getSessionUser() {
   return null;
}

export function subscribeToAuthUser(callback: (user: AuthUser | null) => void) {
   return onAuthStateChanged(auth, async (user) => {
      if (!user) {
         callback(null);
         return;
      }

      try {
         const profile = await ensureUserProfile(user);
         callback(profile);
      } catch (err) {
         if (!isFirestorePermissionDenied(err)) {
            console.error('Failed to resolve Firebase user profile', err);
         }
         callback({
            uid: user.uid,
            fullName:
               user.displayName?.trim() || user.email?.split('@')[0] || 'User',
            email: normalizeEmail(user.email || ''),
         });
      }
   });
}
