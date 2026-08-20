const MAX_POINTS = 300;
const GAP_THRESHOLD_MS = 60 * 1000;

const CHART_WIDTH = 900;
const CHART_HEIGHT = 180;
const PADDING = { top: 12, right: 16, bottom: 28, left: 48 };
const Y_TICK_COUNT = 5;
const X_TICK_COUNT = 6;

const SERIES = [
  { key: "cycle_time_s", label: "Cycle Time", unit: "s", color: "#3b82f6", decimals: 1 },
  { key: "injection_bar", label: "Injection Pressure", unit: "bar", color: "#8b5cf6", decimals: 0 },
  { key: "barrel_temp_c", label: "Barrel Temperature", unit: "°C", color: "#f59e0b", decimals: 1 },
];

// Splits telemetry into runs wherever two consecutive readings are more than
// GAP_THRESHOLD_MS apart, e.g. the simulator was stopped for a while. Each
// run is later drawn as its own line so we never draw a line across a real
// data outage.
function splitByGap(data, gapThresholdMs) {
  if (data.length === 0) return [];
  const runs = [];
  let current = [data[0]];
  for (let i = 1; i < data.length; i++) {
    const prevTime = new Date(data[i - 1].recorded_at).getTime();
    const time = new Date(data[i].recorded_at).getTime();
    if (time - prevTime > gapThresholdMs) {
      runs.push(current);
      current = [data[i]];
    } else {
      current.push(data[i]);
    }
  }
  runs.push(current);
  return runs;
}

// Buckets one run into `targetCount` equal time intervals and averages the
// values in each (skipping null readings). Empty buckets are dropped rather
// than kept as gaps, since a run is by construction free of real outages.
function downsampleRun(run, targetCount) {
  if (run.length <= targetCount) return run;

  const times = run.map((p) => new Date(p.recorded_at).getTime());
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const bucketWidth = (maxTime - minTime) / targetCount || 1;

  const buckets = Array.from({ length: targetCount }, () => []);
  run.forEach((point, i) => {
    let index = Math.floor((times[i] - minTime) / bucketWidth);
    if (index >= targetCount) index = targetCount - 1;
    if (index < 0) index = 0;
    buckets[index].push(point);
  });

  const average = (bucketPoints, key) => {
    const values = bucketPoints.map((p) => p[key]).filter((v) => v !== null && v !== undefined);
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  };

  return buckets
    .filter((bucketPoints) => bucketPoints.length > 0)
    .map((bucketPoints) => {
      const avgTime =
        bucketPoints.reduce((sum, p) => sum + new Date(p.recorded_at).getTime(), 0) /
        bucketPoints.length;
      return {
        recorded_at: new Date(avgTime).toISOString(),
        cycle_time_s: average(bucketPoints, "cycle_time_s"),
        injection_bar: average(bucketPoints, "injection_bar"),
        barrel_temp_c: average(bucketPoints, "barrel_temp_c"),
      };
    });
}

function formatAxisTick(ms, rangeMs, crossesDay) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  if (rangeMs < 60 * 60 * 1000) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  if (crossesDay) {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildXTicks(minTime, maxTime) {
  const rangeMs = maxTime - minTime;
  const crossesDay = new Date(minTime).toDateString() !== new Date(maxTime).toDateString();

  const raw = Array.from({ length: X_TICK_COUNT }, (_, i) => {
    const time = rangeMs === 0 ? minTime : minTime + (rangeMs * i) / (X_TICK_COUNT - 1);
    return { time, label: formatAxisTick(time, rangeMs, crossesDay) };
  });

  // Never render the same label twice in a row.
  let previousLabel = null;
  return raw.map((tick) => {
    if (tick.label === previousLabel) return { ...tick, label: "" };
    previousLabel = tick.label;
    return tick;
  });
}

function MetricChart({ series, runs, rawData, xScale, xTicks }) {
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const allValues = runs
    .flatMap((run) => run.map((p) => p[series.key]))
    .filter((v) => v !== null && v !== undefined);

  const lastRawValue = [...rawData]
    .reverse()
    .find((p) => p[series.key] !== null && p[series.key] !== undefined)?.[series.key];

  const header = (
    <div className="mb-2 flex items-center justify-between">
      <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {series.label} <span className="font-normal text-zinc-400">({series.unit})</span>
      </div>
      <div className="text-lg font-bold" style={{ color: series.color }}>
        {lastRawValue !== undefined ? `${lastRawValue.toFixed(series.decimals)} ${series.unit}` : "-"}
      </div>
    </div>
  );

  if (allValues.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {header}
        <div className="flex h-32 items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
          ไม่มีข้อมูล
        </div>
      </div>
    );
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  const yScale = (value) =>
    max === min
      ? PADDING.top + innerHeight / 2
      : PADDING.top + innerHeight - ((value - min) / (max - min)) * innerHeight;

  const yTicks =
    max === min
      ? [min]
      : Array.from({ length: Y_TICK_COUNT }, (_, i) => min + ((max - min) * i) / (Y_TICK_COUNT - 1));

  const segments = [];
  for (const run of runs) {
    let current = [];
    for (const point of run) {
      const value = point[series.key];
      if (value === null || value === undefined) {
        if (current.length > 0) segments.push(current);
        current = [];
        continue;
      }
      current.push({ x: xScale(new Date(point.recorded_at).getTime()), y: yScale(value) });
    }
    if (current.length > 0) segments.push(current);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {header}

      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img">
        {yTicks.map((tick, i) => {
          const y = yScale(tick);
          return (
            <g key={i}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={CHART_WIDTH - PADDING.right}
                y2={y}
                className="stroke-zinc-100 dark:stroke-zinc-800"
              />
              <text
                x={PADDING.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                className="fill-zinc-500 dark:fill-zinc-400"
              >
                {tick.toFixed(series.decimals)}
              </text>
            </g>
          );
        })}

        {segments.map((segment, i) =>
          segment.length === 1 ? (
            <circle key={i} cx={segment[0].x} cy={segment[0].y} r="2.5" fill={series.color} />
          ) : (
            <path
              key={i}
              d={segment.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
              fill="none"
              stroke={series.color}
              strokeWidth="2"
            />
          )
        )}

        {xTicks.map(
          (tick, i) =>
            tick.label && (
              <text
                key={i}
                x={xScale(tick.time)}
                y={CHART_HEIGHT - PADDING.bottom + 16}
                fontSize="10"
                textAnchor="middle"
                className="fill-zinc-500 dark:fill-zinc-400"
              >
                {tick.label}
              </text>
            )
        )}
      </svg>
    </div>
  );
}

export default function TelemetryChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        ไม่พบข้อมูลในช่วงเวลาที่เลือก
      </div>
    );
  }

  const totalRawPoints = data.length;
  const shouldDownsample = totalRawPoints > MAX_POINTS;

  const rawRuns = splitByGap(data, GAP_THRESHOLD_MS);
  const processedRuns = shouldDownsample
    ? rawRuns.map((run) =>
        downsampleRun(run, Math.max(1, Math.round((run.length / totalRawPoints) * MAX_POINTS)))
      )
    : rawRuns;

  const displayedPointCount = processedRuns.reduce((sum, run) => sum + run.length, 0);

  const minTime = new Date(data[0].recorded_at).getTime();
  const maxTime = new Date(data[data.length - 1].recorded_at).getTime();
  const xTicks = buildXTicks(minTime, maxTime);

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const xScale = (t) => {
    const range = maxTime - minTime;
    return PADDING.left + (range === 0 ? innerWidth / 2 : ((t - minTime) / range) * innerWidth);
  };

  return (
    <div className="flex flex-col gap-4">
      {SERIES.map((series) => (
        <MetricChart
          key={series.key}
          series={series}
          runs={processedRuns}
          rawData={data}
          xScale={xScale}
          xTicks={xTicks}
        />
      ))}

      {shouldDownsample && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          แสดง {displayedPointCount} จุดจากข้อมูล {totalRawPoints} จุด (เฉลี่ยตามช่วงเวลา)
        </p>
      )}
    </div>
  );
}
