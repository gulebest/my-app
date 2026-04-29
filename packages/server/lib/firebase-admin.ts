import {
   applicationDefault,
   cert,
   type Credential,
   getApps,
   initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const DEFAULT_FIREBASE_PROJECT_ID = 'assistly-a5ff4';
let adminCredentialConfigured = false;

function buildCredential() {
   const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
   if (serviceAccountPath) {
      try {
         const file = readFileSync(serviceAccountPath, 'utf8');
         const parsed = JSON.parse(file);
         return cert(parsed);
      } catch (error) {
         throw new Error(
            `Invalid FIREBASE_SERVICE_ACCOUNT_PATH: ${error instanceof Error ? error.message : String(error)}`
         );
      }
   }

   const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
   if (serviceAccountJson) {
      try {
         const parsed = JSON.parse(serviceAccountJson);
         return cert(parsed);
      } catch (error) {
         throw new Error(
            `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error instanceof Error ? error.message : String(error)}`
         );
      }
   }

   const wantsApplicationDefault =
      process.env.FIREBASE_USE_APPLICATION_DEFAULT === 'true' ||
      Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

   // Use ADC when explicitly requested. This works with:
   // 1) GOOGLE_APPLICATION_CREDENTIALS=file.json
   // 2) gcloud auth application-default login
   if (wantsApplicationDefault) {
      return applicationDefault();
   }

   return null;
}

function initFirebaseAdmin() {
   if (getApps().length > 0) {
      return getApps()[0];
   }

   const resolvedProjectId =
      process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
   if (!process.env.FIREBASE_PROJECT_ID) {
      console.warn(
         `FIREBASE_PROJECT_ID is not set. Falling back to "${DEFAULT_FIREBASE_PROJECT_ID}".`
      );
   }

   const resolvedCredential = buildCredential();
   adminCredentialConfigured = Boolean(resolvedCredential);
   if (!resolvedCredential) {
      console.warn(
         'Firebase Admin credential is not configured. Auth token verification will work, but Firestore server persistence requires FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS.'
      );
   }

   const options: { projectId: string; credential?: Credential } = {
      projectId: resolvedProjectId,
   };
   if (resolvedCredential) {
      options.credential = resolvedCredential;
   }

   return initializeApp(options);
}

initFirebaseAdmin();

export const firebaseAdminAuth = getAuth();
export const firebaseAdminDb = getFirestore();
export function isFirebaseAdminCredentialConfigured() {
   return adminCredentialConfigured;
}
