import { useEffect, useState } from 'react';

const NAVIGATION_EVENT = 'assistly:navigate';

function normalizePath(path: string) {
   if (!path.startsWith('/')) {
      return `/${path}`;
   }
   return path;
}

export function navigateTo(path: string, replace = false) {
   const nextPath = normalizePath(path);
   const current = window.location.pathname;
   if (current === nextPath) {
      return;
   }

   if (replace) {
      window.history.replaceState(null, '', nextPath);
   } else {
      window.history.pushState(null, '', nextPath);
   }
   window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function usePathname() {
   const [pathname, setPathname] = useState(() => window.location.pathname);

   useEffect(() => {
      const handleChange = () => {
         setPathname(window.location.pathname);
      };

      window.addEventListener('popstate', handleChange);
      window.addEventListener(NAVIGATION_EVENT, handleChange);

      return () => {
         window.removeEventListener('popstate', handleChange);
         window.removeEventListener(NAVIGATION_EVENT, handleChange);
      };
   }, []);

   return pathname;
}
