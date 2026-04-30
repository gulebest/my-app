import { ApiRequestError } from './conversation-history-api';

export interface UsageBucket {
   label: string;
   count: number;
}

export interface RetentionBucket {
   label: string;
   activeUsers: number;
   returningUsers: number;
}

export interface TopTemplateUsage {
   templateId: string;
   templateTitle: string;
   count: number;
}

export interface AnalyticsSummary {
   generatedAt: string;
   windowDays: number;
   messagesPerDay: UsageBucket[];
   messagesPerWeek: UsageBucket[];
   messagesPerMonth: UsageBucket[];
   activeUsers: number;
   avgResponseTimeMs: number;
   guestVsLoggedUsage: {
      guest: number;
      loggedIn: number;
   };
   topTemplatesUsed: TopTemplateUsage[];
   costEstimate: {
      requests: number;
      estimatedInputTokens: number;
      estimatedOutputTokens: number;
      estimatedTotalTokens: number;
   };
   retention: RetentionBucket[];
}

export async function fetchAnalyticsSummary(
   idToken: string,
   windowDays: number
): Promise<AnalyticsSummary> {
   const response = await fetch(
      `/api/analytics/summary?windowDays=${encodeURIComponent(String(windowDays))}`,
      {
         headers: {
            Authorization: `Bearer ${idToken}`,
         },
      }
   );

   const payload = await response.json();
   if (!response.ok) {
      const message =
         typeof payload === 'object' && payload && 'error' in payload
            ? String((payload as { error?: string }).error || '')
            : '';
      throw new ApiRequestError(
         message || `Failed to load analytics (${response.status})`,
         response.status
      );
   }

   return payload as AnalyticsSummary;
}

export async function exportAnalyticsCsv(
   idToken: string,
   windowDays: number
): Promise<string> {
   const response = await fetch(
      `/api/analytics/export?windowDays=${encodeURIComponent(String(windowDays))}`,
      {
         headers: {
            Authorization: `Bearer ${idToken}`,
         },
      }
   );

   const contentType = response.headers.get('content-type') || '';
   if (!response.ok) {
      let message = `Failed to export analytics (${response.status})`;
      if (contentType.includes('application/json')) {
         const payload = (await response.json()) as { error?: string };
         message = payload.error || message;
      }
      throw new ApiRequestError(message, response.status);
   }

   return response.text();
}
