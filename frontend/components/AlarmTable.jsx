import { formatDateTime, formatDuration } from "@/lib/format";

export default function AlarmTable({ alarms }) {
  if (!alarms || alarms.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">ไม่มี alarm ระหว่างการผลิต</p>;
  }

  // /api/jobs/search's alarms don't include duration_seconds, only the
  // machine history/alarms endpoint does — show the column only when present
  // so this table works for both.
  const showDuration = alarms.some((alarm) => alarm.duration_seconds !== undefined);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="py-2 pr-4 font-medium">Alarm Code</th>
            <th className="py-2 pr-4 font-medium">Message</th>
            <th className="py-2 pr-4 font-medium">Severity</th>
            <th className="py-2 pr-4 font-medium">เวลาที่เกิด</th>
            <th className="py-2 pr-4 font-medium">เวลาที่หาย</th>
            {showDuration && <th className="py-2 font-medium">ระยะเวลา</th>}
          </tr>
        </thead>
        <tbody>
          {alarms.map((alarm, index) => (
            <tr
              key={`${alarm.alarm_code}-${alarm.occurred_at}-${index}`}
              className="border-b border-zinc-100 dark:border-zinc-800"
            >
              <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                {alarm.alarm_code}
              </td>
              <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{alarm.alarm_message}</td>
              <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{alarm.severity}</td>
              <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                {formatDateTime(alarm.occurred_at)}
              </td>
              <td className="py-2 pr-4">
                {alarm.cleared_at ? (
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {formatDateTime(alarm.cleared_at)}
                  </span>
                ) : (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400">
                    ยังไม่หาย
                  </span>
                )}
              </td>
              {showDuration && (
                <td className="py-2 text-zinc-700 dark:text-zinc-300">
                  {formatDuration(alarm.duration_seconds)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
