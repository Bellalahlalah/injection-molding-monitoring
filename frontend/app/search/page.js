"use client";

import { useState } from "react";
import { searchJobs } from "@/lib/api";
import JobCard from "@/components/JobCard";

export default function SearchPage() {
  const [jobNumber, setJobNumber] = useState("");
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error | success
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSearch(event) {
    event.preventDefault();
    const trimmed = jobNumber.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const results = await searchJobs(trimmed);
      setJobs(results);
      setStatus("success");
    } catch (error) {
      setErrorMessage("ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Search</h1>

      <form onSubmit={handleSearch} className="mb-2 flex gap-2">
        <input
          type="text"
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder="Job Number"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          ค้นหา
        </button>
      </form>
      <p className="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
        ค้นบางส่วนได้ เช่น JOB-2608
      </p>

      {status === "loading" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">กำลังค้นหา...</p>
      )}

      {status === "error" && (
        <div className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white">
          {errorMessage}
        </div>
      )}

      {status === "success" && jobs.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">ไม่พบ Job Number นี้</p>
      )}

      <div className="flex flex-col gap-4">
        {jobs.map((job) => (
          <JobCard key={job.job_number} job={job} />
        ))}
      </div>
    </div>
  );
}
