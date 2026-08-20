"use client";

import { useEffect, useState } from "react";
import { getMachines, getMachineHistory, getMachineAlarms } from "@/lib/api";
import TelemetryChart from "@/components/TelemetryChart";
import AlarmTable from "@/components/AlarmTable";

function toDateTimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function HistoricalPage() {
  const [machines, setMachines] = useState([]);
  const [machinesError, setMachinesError] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState("");

  const [fromTime, setFromTime] = useState(() =>
    toDateTimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000))
  );
  const [toTime, setToTime] = useState(() => toDateTimeLocalValue(new Date()));

  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [alarmsError, setAlarmsError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMachines() {
      try {
        const data = await getMachines();
        if (!isMounted) return;
        setMachines(data);
        if (data.length > 0) setSelectedMachineId(data[0].machine_id);
      } catch (error) {
        if (!isMounted) return;
        setMachinesError(true);
      }
    }

    loadMachines();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    if (!selectedMachineId) return;

    setLoading(true);
    setSearched(true);

    const fromIso = fromTime ? new Date(fromTime).toISOString() : undefined;
    const toIso = toTime ? new Date(toTime).toISOString() : undefined;

    const [historyResult, alarmsResult] = await Promise.allSettled([
      getMachineHistory(selectedMachineId, fromIso, toIso),
      getMachineAlarms(selectedMachineId, fromIso, toIso),
    ]);

    if (historyResult.status === "fulfilled") {
      setHistory(historyResult.value);
      setHistoryError(null);
    } else {
      setHistoryError("โหลดข้อมูล telemetry ไม่สำเร็จ");
    }

    if (alarmsResult.status === "fulfilled") {
      setAlarms(alarmsResult.value);
      setAlarmsError(null);
    } else {
      setAlarmsError("โหลดประวัติ alarm ไม่สำเร็จ");
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Historical</h1>

      {machinesError && (
        <div className="mb-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white">
          โหลดรายชื่อเครื่องไม่สำเร็จ
        </div>
      )}

      <form
        onSubmit={handleSearch}
        className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">เครื่อง</label>
          <select
            value={selectedMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {machines.map((m) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_id} - {m.machine_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">เวลาเริ่ม</label>
          <input
            type="datetime-local"
            value={fromTime}
            onChange={(e) => setFromTime(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">เวลาสิ้นสุด</label>
          <input
            type="datetime-local"
            value={toTime}
            onChange={(e) => setToTime(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <button
          type="submit"
          disabled={!selectedMachineId || loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "กำลังค้นหา..." : "ค้นหา"}
        </button>
      </form>

      <div className="mb-6">
        {historyError ? (
          <div className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white">
            {historyError}
          </div>
        ) : searched ? (
          <TelemetryChart data={history} />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            เลือกเครื่องและช่วงเวลา แล้วกด &quot;ค้นหา&quot;
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          ประวัติ Alarm
        </h2>
        {alarmsError ? (
          <div className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white">
            {alarmsError}
          </div>
        ) : searched ? (
          <AlarmTable alarms={alarms} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">ยังไม่ได้ค้นหา</p>
        )}
      </div>
    </div>
  );
}
