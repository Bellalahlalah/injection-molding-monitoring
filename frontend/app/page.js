"use client";

import { useEffect, useState } from "react";
import { getLiveMachines } from "@/lib/api";
import SummaryCard from "@/components/SummaryCard";
import MachineCard from "@/components/MachineCard";

const REFRESH_INTERVAL_MS = 3000;

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

// OEE = Availability x Performance x Quality.
// Availability is fleet-wide (share of non-offline machines currently RUN),
// while Performance and Quality are per-machine ratios averaged across
// machines that currently have enough data to compute them.
function computeFleetOEE(machines) {
  const trackedMachines = machines.filter((m) => m.status !== "OFFLINE");
  if (trackedMachines.length === 0) return null;

  const availability =
    trackedMachines.filter((m) => m.status === "RUN").length / trackedMachines.length;

  const performanceValues = trackedMachines
    .map((m) => (m.cycle_time_s ? m.ideal_cycle_time_s / m.cycle_time_s : null))
    .filter((value) => value !== null);
  if (performanceValues.length === 0) return null;
  const performance =
    performanceValues.reduce((sum, value) => sum + value, 0) / performanceValues.length;

  const qualityValues = trackedMachines
    .map((m) => {
      const total = (m.good_qty ?? 0) + (m.reject_qty ?? 0);
      return total > 0 ? m.good_qty / total : null;
    })
    .filter((value) => value !== null);
  if (qualityValues.length === 0) return null;
  const quality = qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length;

  return availability * performance * quality;
}

export default function DashboardPage() {
  const [machines, setMachines] = useState([]);
  const [connectionError, setConnectionError] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function refresh() {
      try {
        const data = await getLiveMachines();
        if (!isMounted) return;
        setMachines(data);
        setConnectionError(false);
        setLastRefreshedAt(new Date());
      } catch (error) {
        // Keep the last known machine data on screen instead of clearing it.
        if (!isMounted) return;
        setConnectionError(true);
      }
    }

    refresh();
    const intervalId = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const runCount = machines.filter((m) => m.status === "RUN").length;
  const alarmCount = machines.filter((m) => m.status === "ALARM").length;
  const offlineCount = machines.filter((m) => m.status === "OFFLINE").length;
  const fleetOEE = computeFleetOEE(machines);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {connectionError && (
        <div className="mb-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white">
          ไม่สามารถเชื่อมต่อ backend ได้
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {lastRefreshedAt
            ? `รีเฟรชล่าสุด ${lastRefreshedAt.toLocaleTimeString("th-TH")}`
            : "กำลังโหลด..."}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="RUN" value={runCount} />
        <SummaryCard label="ALARM" value={alarmCount} />
        <SummaryCard label="OFFLINE" value={offlineCount} />
        <SummaryCard label="OEE เฉลี่ย" value={formatPercent(fleetOEE)} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {machines.map((machine) => (
          <MachineCard key={machine.machine_id} machine={machine} />
        ))}
      </div>

      {machines.length === 0 && !connectionError && (
        <div className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          กำลังโหลดข้อมูลเครื่องจักร...
        </div>
      )}
    </div>
  );
}
