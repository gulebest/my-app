import { Download, Timer, Users, MessageSquare, Coins } from 'lucide-react';
import type { AnalyticsSummary } from '../lib/analytics-api';

interface StatisticsPageProps {
   currentUserEmail: string | null;
   summary: AnalyticsSummary | null;
   loading: boolean;
   error: string | null;
   windowDays: number;
   onWindowDaysChange: (days: number) => void;
   onExportCsv: () => void;
}

function formatNumber(value: number) {
   return new Intl.NumberFormat().format(value);
}

function maxCount(items: { count: number }[]) {
   return items.reduce((max, item) => Math.max(max, item.count), 0);
}

function MiniBars({
   title,
   items,
}: {
   title: string;
   items: { label: string; count: number }[];
}) {
   const peak = maxCount(items) || 1;
   return (
      <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
         <h3 className="mb-3 text-sm font-semibold text-(--app-text-strong)">
            {title}
         </h3>
         <div className="grid grid-cols-12 items-end gap-1">
            {items.slice(-12).map((item) => (
               <div
                  key={item.label}
                  className="flex flex-col items-center gap-1"
               >
                  <div
                     className="w-full rounded bg-indigo-500/80"
                     style={{
                        height: `${Math.max(6, (item.count / peak) * 68)}px`,
                     }}
                     title={`${item.label}: ${item.count}`}
                  />
                  <span className="text-[10px] text-(--app-text-muted)">
                     {item.label.slice(-2)}
                  </span>
               </div>
            ))}
         </div>
      </div>
   );
}

function RetentionChart({
   items,
}: {
   items: { label: string; activeUsers: number; returningUsers: number }[];
}) {
   const recent = items.slice(-14);
   const peak = recent.reduce(
      (max, item) => Math.max(max, item.activeUsers, item.returningUsers),
      0
   );
   const normalizedPeak = peak || 1;

   return (
      <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
         <h3 className="mb-3 text-sm font-semibold text-(--app-text-strong)">
            Retention (Returning Users)
         </h3>
         <div className="space-y-2">
            {recent.map((item) => (
               <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-(--app-text-muted)">
                     <span>{item.label}</span>
                     <span>
                        {item.returningUsers}/{item.activeUsers}
                     </span>
                  </div>
                  <div className="h-2 rounded bg-[var(--app-soft-surface)]">
                     <div
                        className="h-2 rounded bg-indigo-500"
                        style={{
                           width: `${(item.returningUsers / normalizedPeak) * 100}%`,
                        }}
                     />
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
}

export function StatisticsPage({
   currentUserEmail,
   summary,
   loading,
   error,
   windowDays,
   onWindowDaysChange,
   onExportCsv,
}: StatisticsPageProps) {
   if (!currentUserEmail) {
      return (
         <section className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-[var(--app-divider)] bg-[var(--app-header-bg)] p-6">
            <div className="max-w-md text-center">
               <h2 className="text-xl font-semibold text-(--app-text-strong)">
                  Sign in to view statistics
               </h2>
               <p className="mt-2 text-sm text-(--app-text-muted)">
                  Usage analytics is available for authenticated users.
               </p>
            </div>
         </section>
      );
   }

   return (
      <section className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-[var(--app-divider)] bg-[var(--app-header-bg)] p-4 sm:p-6">
         <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
               <h1 className="text-xl font-semibold text-(--app-text-strong)">
                  Usage Statistics
               </h1>
               <p className="text-sm text-(--app-text-muted)">
                  Messages, active users, response latency, retention, and
                  template usage.
               </p>
            </div>
            <div className="flex items-center gap-2">
               <select
                  value={windowDays}
                  onChange={(event) =>
                     onWindowDaysChange(Number(event.target.value))
                  }
                  className="rounded-xl border border-(--app-input-border) bg-[var(--app-input-bar-bg)] px-3 py-2 text-sm text-(--app-text-strong)"
               >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
               </select>
               <button
                  type="button"
                  onClick={onExportCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-(--app-input-border) bg-[var(--app-soft-surface)] px-3 py-2 text-sm text-(--app-text-strong)"
               >
                  <Download className="h-4 w-4" />
                  Export CSV
               </button>
            </div>
         </div>

         {loading && (
            <div className="rounded-xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] px-4 py-3 text-sm text-(--app-text-muted)">
               Loading analytics...
            </div>
         )}
         {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
               {error}
            </div>
         )}

         {summary && (
            <>
               <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
                     <div className="mb-2 flex items-center gap-2 text-(--app-text-muted)">
                        <MessageSquare className="h-4 w-4" />
                        Requests
                     </div>
                     <div className="text-2xl font-semibold text-(--app-text-strong)">
                        {formatNumber(summary.costEstimate.requests)}
                     </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
                     <div className="mb-2 flex items-center gap-2 text-(--app-text-muted)">
                        <Users className="h-4 w-4" />
                        Active users
                     </div>
                     <div className="text-2xl font-semibold text-(--app-text-strong)">
                        {formatNumber(summary.activeUsers)}
                     </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
                     <div className="mb-2 flex items-center gap-2 text-(--app-text-muted)">
                        <Timer className="h-4 w-4" />
                        Avg response
                     </div>
                     <div className="text-2xl font-semibold text-(--app-text-strong)">
                        {formatNumber(summary.avgResponseTimeMs)}ms
                     </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
                     <div className="mb-2 text-(--app-text-muted)">
                        Guest usage
                     </div>
                     <div className="text-2xl font-semibold text-(--app-text-strong)">
                        {formatNumber(summary.guestVsLoggedUsage.guest)}
                     </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
                     <div className="mb-2 text-(--app-text-muted)">
                        Logged-in usage
                     </div>
                     <div className="text-2xl font-semibold text-(--app-text-strong)">
                        {formatNumber(summary.guestVsLoggedUsage.loggedIn)}
                     </div>
                  </div>
               </div>

               <div className="mb-4 grid gap-3 lg:grid-cols-3">
                  <MiniBars
                     title="Messages per day"
                     items={summary.messagesPerDay}
                  />
                  <MiniBars
                     title="Messages per week"
                     items={summary.messagesPerWeek}
                  />
                  <MiniBars
                     title="Messages per month"
                     items={summary.messagesPerMonth}
                  />
               </div>

               <div className="mb-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
                     <h3 className="mb-3 text-sm font-semibold text-(--app-text-strong)">
                        Top Templates Used
                     </h3>
                     {summary.topTemplatesUsed.length === 0 ? (
                        <p className="text-sm text-(--app-text-muted)">
                           No template runs tracked in this period yet.
                        </p>
                     ) : (
                        <div className="space-y-2">
                           {summary.topTemplatesUsed.map((item) => (
                              <div
                                 key={item.templateId}
                                 className="flex items-center justify-between rounded-xl bg-[var(--app-soft-surface)] px-3 py-2"
                              >
                                 <span className="truncate text-sm text-(--app-text-strong)">
                                    {item.templateTitle}
                                 </span>
                                 <span className="text-xs text-(--app-text-muted)">
                                    {item.count}
                                 </span>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>

                  <div className="rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-card-bg)] p-4">
                     <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-(--app-text-strong)">
                        <Coins className="h-4 w-4" />
                        Cost / Consumption Estimate
                     </h3>
                     <div className="space-y-2 text-sm text-(--app-text-muted)">
                        <p>
                           Estimated input tokens:{' '}
                           <strong className="text-(--app-text-strong)">
                              {formatNumber(
                                 summary.costEstimate.estimatedInputTokens
                              )}
                           </strong>
                        </p>
                        <p>
                           Estimated output tokens:{' '}
                           <strong className="text-(--app-text-strong)">
                              {formatNumber(
                                 summary.costEstimate.estimatedOutputTokens
                              )}
                           </strong>
                        </p>
                        <p>
                           Estimated total tokens:{' '}
                           <strong className="text-(--app-text-strong)">
                              {formatNumber(
                                 summary.costEstimate.estimatedTotalTokens
                              )}
                           </strong>
                        </p>
                     </div>
                  </div>
               </div>

               <RetentionChart items={summary.retention} />
            </>
         )}
      </section>
   );
}
