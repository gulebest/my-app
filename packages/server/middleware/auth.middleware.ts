import type { Request, Response, NextFunction } from 'express';
import { firebaseAdminAuth } from '../lib/firebase-admin';

function extractBearerToken(header?: string) {
   if (!header) {
      return null;
   }

   const [scheme, token] = header.trim().split(/\s+/);
   if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
   }
   return token;
}

export async function requireFirebaseAuth(
   req: Request,
   res: Response,
   next: NextFunction
) {
   const token = extractBearerToken(req.headers.authorization);
   if (!token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
   }

   try {
      const decoded = await firebaseAdminAuth.verifyIdToken(token);
      req.authUser = decoded;
      next();
   } catch (error) {
      return res.status(401).json({
         error: 'Invalid or expired Firebase token',
         details: error instanceof Error ? error.message : String(error),
      });
   }
}

export async function optionalFirebaseAuth(
   req: Request,
   _res: Response,
   next: NextFunction
) {
   const token = extractBearerToken(req.headers.authorization);
   if (!token) {
      req.authUser = undefined;
      next();
      return;
   }

   try {
      const decoded = await firebaseAdminAuth.verifyIdToken(token);
      req.authUser = decoded;
   } catch {
      req.authUser = undefined;
   }
   next();
}
