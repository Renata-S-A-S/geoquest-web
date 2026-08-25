import { Trophy } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { EmptyState } from '@/shared/components/empty-state'
import { cn } from '@/shared/lib/cn'
import { useLeaderboard } from '@/features/gamification/queries'
import { buildLeaderboardRows, type LeaderboardRow } from '@/features/gamification/leaderboard-rows'

/**
 * `/premios/leaderboard` — WU10 (gamification) PR6. Container + list;
 * `rank` is rendered exactly as the backend computes it (competition
 * ranking, ties share a number — see `leaderboard-rows.ts`). Own row is
 * highlighted in place when inside `top`, or shown as a separate pinned
 * row at the end when outside it (spec "Own Rank Highlighted Even Outside
 * Visible List").
 */
export function LeaderboardPage() {
  const { t } = useTranslation('gamification')
  const { data, isPending, isError, refetch } = useLeaderboard()

  if (isPending) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <span className="font-sans text-xs text-ink">{t('leaderboard.loadError')}</span>
        <Button variant="primary" onClick={() => refetch()}>
          {t('leaderboard.retry')}
        </Button>
      </div>
    )
  }

  const rows = buildLeaderboardRows(data.top, data.me)
  const topRows = rows.filter((row) => !row.pinned)
  const pinnedRow = rows.find((row) => row.pinned)

  return (
    <div className="flex flex-col gap-3 p-4">
      <b className="font-display text-base text-ink">{t('leaderboard.title')}</b>

      {data.top.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={t('leaderboard.emptyTitle')}
          description={t('leaderboard.emptyDescription')}
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {topRows.map((row) => (
            <LeaderboardRowItem key={row.explorerId} row={row} />
          ))}
        </ul>
      )}

      {pinnedRow && (
        <div className="border-t border-border pt-2" data-testid="leaderboard-pinned-row">
          <LeaderboardRowItem row={pinnedRow} />
        </div>
      )}
    </div>
  )
}

function LeaderboardRowItem({ row }: { row: LeaderboardRow }) {
  const { t } = useTranslation('gamification')

  return (
    <li
      data-testid={`leaderboard-row-${row.explorerId}`}
      data-me={row.isMe}
      className={cn(
        'flex items-center gap-2.5 rounded-md border border-border bg-white px-3 py-2',
        row.isMe && 'border-teal bg-surface-teal'
      )}
    >
      <span className="w-8 font-mono text-[11px] font-bold text-muted">#{row.rank}</span>
      <Avatar initial={row.username.charAt(0).toUpperCase()} src={row.avatarUrl} size="sm" />
      <span className="flex-1 font-sans text-xs font-bold text-ink">{row.username}</span>
      <span className="font-mono text-[11px] text-muted">
        {t('leaderboard.xp', { xp: row.weeklyXP })}
      </span>
    </li>
  )
}
