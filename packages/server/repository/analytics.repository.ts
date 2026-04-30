import { FieldValue } from 'firebase-admin/firestore';
import {
   firebaseAdminDb,
   isFirebaseAdminCredentialConfigured,
} from '../lib/firebase-admin';

type AuthType = 'guest' | 'logged_in';

export interface UsageEventInput {
   uid: string | null;
   authType: AuthType;
   conversationId: string;
   projectId?: string | null;
   templateId?: string | null;
   templateTitle?: string | null;
   templateVersion?: number | null;
   promptLength: number;
   responseLength: number;
   estimatedInputTokens: number;
   estimatedOutputTokens: number;
   estimatedTotalTokens: number;
   responseTimeMs: number;
}

export interface UsageEventRecord extends UsageEventInput {
   createdAt: Date;
}

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

const MAX_IN_MEMORY_EVENTS = 20000;

function toIsoDay(date: Date) {
   return date.toISOString().slice(0, 10);
}

function toWeekLabel(date: Date) {
   const utc = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
   );
   const day = utc.getUTCDay() || 7;
   utc.setUTCDate(utc.getUTCDate() + 4 - day);
   const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
   const weekNo = Math.ceil(
      ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
   );
   return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function toMonthLabel(date: Date) {
   return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function estimateTokenCount(text: string) {
   const trimmed = text.trim();
   if (!trimmed) {
      return 0;
   }
   return Math.max(1, Math.ceil(trimmed.length / 4));
}

function toDate(value: unknown): Date | null {
   if (!value) {
      return null;
   }
   if (value instanceof Date) {
      return value;
   }
   if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof value.toDate === 'function'
   ) {
      const asDate = value.toDate();
      return asDate instanceof Date ? asDate : null;
   }
   return null;
}

class AnalyticsRepository {
   private inMemoryEvents: UsageEventRecord[] = [];

   async recordUsageEvent(event: UsageEventInput) {
      const normalizedEvent: UsageEventRecord = {
         ...event,
         createdAt: new Date(),
      };

      this.inMemoryEvents.push(normalizedEvent);
      if (this.inMemoryEvents.length > MAX_IN_MEMORY_EVENTS) {
         this.inMemoryEvents = this.inMemoryEvents.slice(
            this.inMemoryEvents.length - MAX_IN_MEMORY_EVENTS
         );
      }

      if (!isFirebaseAdminCredentialConfigured()) {
         return;
      }

      try {
         await firebaseAdminDb.collection('analyticsEvents').add({
            ...event,
            createdAt: FieldValue.serverTimestamp(),
         });
      } catch (error) {
         console.warn('Failed to persist analytics event in Firestore', error);
      }
   }

   async loadRecentUsageEvents(days = 400): Promise<UsageEventRecord[]> {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      if (!isFirebaseAdminCredentialConfigured()) {
         return this.inMemoryEvents.filter((item) => item.createdAt >= cutoff);
      }

      try {
         const snapshot = await firebaseAdminDb
            .collection('analyticsEvents')
            .where('createdAt', '>=', cutoff)
            .orderBy('createdAt', 'asc')
            .limit(8000)
            .get();

         const records = snapshot.docs
            .map((doc) => doc.data())
            .map((data) => {
               const createdAt = toDate(data.createdAt);
               if (!createdAt) {
                  return null;
               }

               return {
                  uid: typeof data.uid === 'string' ? data.uid : null,
                  authType:
                     data.authType === 'logged_in' ? 'logged_in' : 'guest',
                  conversationId: String(data.conversationId || ''),
                  projectId:
                     typeof data.projectId === 'string' ? data.projectId : null,
                  templateId:
                     typeof data.templateId === 'string'
                        ? data.templateId
                        : null,
                  templateTitle:
                     typeof data.templateTitle === 'string'
                        ? data.templateTitle
                        : null,
                  templateVersion:
                     typeof data.templateVersion === 'number'
                        ? data.templateVersion
                        : null,
                  promptLength: Number(data.promptLength || 0),
                  responseLength: Number(data.responseLength || 0),
                  estimatedInputTokens: Number(data.estimatedInputTokens || 0),
                  estimatedOutputTokens: Number(
                     data.estimatedOutputTokens || 0
                  ),
                  estimatedTotalTokens: Number(data.estimatedTotalTokens || 0),
                  responseTimeMs: Number(data.responseTimeMs || 0),
                  createdAt,
               } satisfies UsageEventRecord;
            })
            .filter((item): item is UsageEventRecord => item !== null);

         return records;
      } catch (error) {
         console.warn(
            'Failed to load analytics events from Firestore, using in-memory events',
            error
         );
         return this.inMemoryEvents.filter((item) => item.createdAt >= cutoff);
      }
   }

   async buildSummary(windowDays = 30): Promise<AnalyticsSummary> {
      const allEvents = await this.loadRecentUsageEvents(400);
      const now = new Date();
      const rangeStart = new Date(
         Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - (windowDays - 1)
         )
      );
      const rangeEvents = allEvents.filter(
         (item) => item.createdAt >= rangeStart
      );

      const dayBuckets = new Map<string, number>();
      for (let index = windowDays - 1; index >= 0; index -= 1) {
         const day = new Date(
            Date.UTC(
               now.getUTCFullYear(),
               now.getUTCMonth(),
               now.getUTCDate() - index
            )
         );
         dayBuckets.set(toIsoDay(day), 0);
      }

      const weekBuckets = new Map<string, number>();
      const monthBuckets = new Map<string, number>();
      const topTemplateCounts = new Map<string, TopTemplateUsage>();
      const activeUserIds = new Set<string>();
      const userActiveDays = new Map<string, Set<string>>();

      let guestCount = 0;
      let loggedInCount = 0;
      let responseTimeTotal = 0;
      let responseTimeCount = 0;
      let estimatedInputTokens = 0;
      let estimatedOutputTokens = 0;
      let estimatedTotalTokens = 0;

      for (const event of rangeEvents) {
         const dayKey = toIsoDay(event.createdAt);
         const weekKey = toWeekLabel(event.createdAt);
         const monthKey = toMonthLabel(event.createdAt);

         dayBuckets.set(dayKey, (dayBuckets.get(dayKey) || 0) + 1);
         weekBuckets.set(weekKey, (weekBuckets.get(weekKey) || 0) + 1);
         monthBuckets.set(monthKey, (monthBuckets.get(monthKey) || 0) + 1);

         if (event.authType === 'guest') {
            guestCount += 1;
         } else {
            loggedInCount += 1;
            if (event.uid) {
               activeUserIds.add(event.uid);
               const existingDays =
                  userActiveDays.get(event.uid) || new Set<string>();
               existingDays.add(dayKey);
               userActiveDays.set(event.uid, existingDays);
            }
         }

         if (event.responseTimeMs > 0) {
            responseTimeTotal += event.responseTimeMs;
            responseTimeCount += 1;
         }

         estimatedInputTokens += event.estimatedInputTokens;
         estimatedOutputTokens += event.estimatedOutputTokens;
         estimatedTotalTokens += event.estimatedTotalTokens;

         if (event.templateId || event.templateTitle) {
            const templateId = event.templateId || 'unknown-template';
            const templateTitle = event.templateTitle || 'Unknown template';
            const current = topTemplateCounts.get(templateId);
            if (!current) {
               topTemplateCounts.set(templateId, {
                  templateId,
                  templateTitle,
                  count: 1,
               });
            } else {
               current.count += 1;
            }
         }
      }

      const messagesPerDay: UsageBucket[] = [...dayBuckets.entries()].map(
         ([label, count]) => ({ label, count })
      );

      const messagesPerWeek = [...weekBuckets.entries()]
         .sort((a, b) => a[0].localeCompare(b[0]))
         .map(([label, count]) => ({ label, count }))
         .slice(-12);

      const messagesPerMonth = [...monthBuckets.entries()]
         .sort((a, b) => a[0].localeCompare(b[0]))
         .map(([label, count]) => ({ label, count }))
         .slice(-12);

      const topTemplatesUsed = [...topTemplateCounts.values()]
         .sort((a, b) => b.count - a.count)
         .slice(0, 6);

      const returningByDay = new Map<string, number>();
      for (const days of userActiveDays.values()) {
         const sortedDays = [...days].sort((a, b) => a.localeCompare(b));
         for (let index = 1; index < sortedDays.length; index += 1) {
            const day = sortedDays[index];
            returningByDay.set(day, (returningByDay.get(day) || 0) + 1);
         }
      }

      const activeByDay = new Map<string, number>();
      for (const days of userActiveDays.values()) {
         for (const day of days) {
            activeByDay.set(day, (activeByDay.get(day) || 0) + 1);
         }
      }

      const retention: RetentionBucket[] = messagesPerDay.map((item) => ({
         label: item.label,
         activeUsers: activeByDay.get(item.label) || 0,
         returningUsers: returningByDay.get(item.label) || 0,
      }));

      return {
         generatedAt: new Date().toISOString(),
         windowDays,
         messagesPerDay,
         messagesPerWeek,
         messagesPerMonth,
         activeUsers: activeUserIds.size,
         avgResponseTimeMs:
            responseTimeCount > 0
               ? Math.round(responseTimeTotal / responseTimeCount)
               : 0,
         guestVsLoggedUsage: {
            guest: guestCount,
            loggedIn: loggedInCount,
         },
         topTemplatesUsed,
         costEstimate: {
            requests: rangeEvents.length,
            estimatedInputTokens,
            estimatedOutputTokens,
            estimatedTotalTokens,
         },
         retention,
      };
   }

   async exportSummaryCsv(windowDays = 30) {
      const summary = await this.buildSummary(windowDays);
      const lines: string[] = [];
      lines.push('metric,dimension,value');

      for (const day of summary.messagesPerDay) {
         lines.push(`messages_per_day,${day.label},${day.count}`);
      }
      for (const week of summary.messagesPerWeek) {
         lines.push(`messages_per_week,${week.label},${week.count}`);
      }
      for (const month of summary.messagesPerMonth) {
         lines.push(`messages_per_month,${month.label},${month.count}`);
      }
      lines.push(`active_users,current_window,${summary.activeUsers}`);
      lines.push(
         `avg_response_time_ms,current_window,${summary.avgResponseTimeMs}`
      );
      lines.push(
         `guest_usage,current_window,${summary.guestVsLoggedUsage.guest}`
      );
      lines.push(
         `logged_in_usage,current_window,${summary.guestVsLoggedUsage.loggedIn}`
      );
      lines.push(
         `estimated_requests,current_window,${summary.costEstimate.requests}`
      );
      lines.push(
         `estimated_input_tokens,current_window,${summary.costEstimate.estimatedInputTokens}`
      );
      lines.push(
         `estimated_output_tokens,current_window,${summary.costEstimate.estimatedOutputTokens}`
      );
      lines.push(
         `estimated_total_tokens,current_window,${summary.costEstimate.estimatedTotalTokens}`
      );
      for (const template of summary.topTemplatesUsed) {
         lines.push(
            `top_template,${template.templateTitle.replaceAll(',', ' ')},${template.count}`
         );
      }
      for (const day of summary.retention) {
         lines.push(`retention_active_users,${day.label},${day.activeUsers}`);
         lines.push(
            `retention_returning_users,${day.label},${day.returningUsers}`
         );
      }

      return lines.join('\n');
   }

   estimateFromPromptAndResponse(prompt: string, response: string) {
      const estimatedInputTokens = estimateTokenCount(prompt);
      const estimatedOutputTokens = estimateTokenCount(response);
      return {
         estimatedInputTokens,
         estimatedOutputTokens,
         estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
      };
   }
}

export const analyticsRepository = new AnalyticsRepository();
