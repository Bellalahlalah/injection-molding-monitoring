const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: GET ${path} -> ${response.status}`);
  }
  return response.json();
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getLiveMachines() {
  return apiGet("/api/machines/live");
}

export function getMachines() {
  return apiGet("/api/machines");
}

export function getMachineHistory(machineId, fromTime, toTime, limit) {
  const query = buildQuery({ from_time: fromTime, to_time: toTime, limit });
  return apiGet(`/api/machines/${encodeURIComponent(machineId)}/history${query}`);
}

export function getMachineAlarms(machineId, fromTime, toTime) {
  const query = buildQuery({ from_time: fromTime, to_time: toTime });
  return apiGet(`/api/machines/${encodeURIComponent(machineId)}/alarms${query}`);
}

export function searchJobs(jobNumber) {
  const query = buildQuery({ job_number: jobNumber });
  return apiGet(`/api/jobs/search${query}`);
}

export function getActiveAlarms() {
  return apiGet("/api/alarms/active");
}
