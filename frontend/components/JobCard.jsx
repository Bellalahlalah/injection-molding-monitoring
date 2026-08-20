import { formatDateTime } from "@/lib/format";
import AlarmTable from "./AlarmTable";

const JOB_STATUS_STYLES = {
  RUNNING: "bg-emerald-500 text-white",
};
const DEFAULT_JOB_STATUS_STYLE = "bg-zinc-400 text-white";

function formatYield(good, reject) {
  const total = (good ?? 0) + (reject ?? 0);
  if (total === 0) return "-";
  return `${((good / total) * 100).toFixed(1)}%`;
}

function buildFieldRows(job) {
  return [
    { label: "Machine", value: `${job.machine_id} · ${job.machine_name ?? "-"}` },
    { label: "Product", value: `${job.product_code ?? "-"} · ${job.product_name ?? "-"}` },
    { label: "Mold ID", value: job.mold_id ?? "-" },
    { label: "Recipe ID", value: job.recipe_id ?? "-" },
    { label: "Planned Qty", value: job.planned_qty ?? "-" },
    { label: "Good Qty", value: job.good_qty ?? 0 },
    { label: "Reject Qty", value: job.reject_qty ?? 0 },
    { label: "Yield %", value: formatYield(job.good_qty, job.reject_qty) },
    { label: "เวลาเริ่ม", value: formatDateTime(job.started_at) },
    { label: "เวลาสิ้นสุด", value: job.ended_at ? formatDateTime(job.ended_at) : "กำลังผลิต" },
  ];
}

export default function JobCard({ job }) {
  const statusStyle = JOB_STATUS_STYLES[job.status] ?? DEFAULT_JOB_STATUS_STYLE;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{job.job_number}</div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle}`}>
          {job.status}
        </span>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {buildFieldRows(job).map((row) => (
            <tr key={row.label} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1.5 pr-4 text-zinc-500 dark:text-zinc-400">{row.label}</td>
              <td className="py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4">
        <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Alarms</div>
        <AlarmTable alarms={job.alarms} />
      </div>
    </div>
  );
}
