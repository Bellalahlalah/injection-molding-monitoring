import StatusBadge from "./StatusBadge";

const OFFLINE_MESSAGE = "ไม่ได้รับข้อมูลเกิน 30 วินาที";

function formatSecondsAgo(seconds) {
  if (seconds === null || seconds === undefined) return "ยังไม่มีข้อมูล";
  const rounded = Math.round(seconds);
  if (rounded < 60) return `อัปเดตล่าสุด ${rounded} วินาทีที่แล้ว`;
  return `อัปเดตล่าสุด ${Math.round(rounded / 60)} นาทีที่แล้ว`;
}

const DATA_ROWS = [
  { label: "Job Number", key: "job_number" },
  { label: "Product Code", key: "product_code" },
];

export default function MachineCard({ machine }) {
  const isOffline = machine.status === "OFFLINE";
  const cycleTimeText =
    machine.cycle_time_s != null ? `${machine.cycle_time_s}s` : "-";

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${
        isOffline ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {machine.machine_id}
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {machine.brand ?? "-"} · {machine.tonnage != null ? `${machine.tonnage} T` : "-"}
          </div>
        </div>
        <StatusBadge status={machine.status} />
      </div>

      {machine.active_alarm_code && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {machine.active_alarm_code} · {machine.active_alarm_message}
        </div>
      )}

      {isOffline && (
        <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{OFFLINE_MESSAGE}</div>
      )}

      <table className="mt-4 w-full text-sm">
        <tbody>
          {DATA_ROWS.map((row) => (
            <tr key={row.key} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1.5 text-zinc-500 dark:text-zinc-400">{row.label}</td>
              <td className="py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
                {machine[row.key] ?? "-"}
              </td>
            </tr>
          ))}
          <tr className="border-t border-zinc-100 dark:border-zinc-800">
            <td className="py-1.5 text-zinc-500 dark:text-zinc-400">Cycle Time</td>
            <td className="py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
              {cycleTimeText}
            </td>
          </tr>
          <tr className="border-t border-zinc-100 dark:border-zinc-800">
            <td className="py-1.5 text-zinc-500 dark:text-zinc-400">Good / Reject</td>
            <td className="py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
              {machine.good_qty ?? 0} / {machine.reject_qty ?? 0}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        {formatSecondsAgo(machine.seconds_since_update)}
      </div>
    </div>
  );
}
