const STATUS_STYLES = {
  RUN: "bg-emerald-500 text-white",
  STOP: "bg-amber-400 text-amber-950",
  ALARM: "bg-red-500 text-white",
  OFFLINE: "bg-zinc-400 text-white",
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.OFFLINE;

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {status}
    </span>
  );
}
