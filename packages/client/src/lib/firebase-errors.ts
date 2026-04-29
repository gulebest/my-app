export function isFirestorePermissionDenied(error: unknown) {
   if (!error || typeof error !== 'object') {
      return false;
   }

   const maybeCode = 'code' in error ? String(error.code || '') : '';
   if (maybeCode.includes('permission-denied')) {
      return true;
   }

   const maybeMessage = 'message' in error ? String(error.message || '') : '';
   return maybeMessage.toLowerCase().includes('insufficient permissions');
}
