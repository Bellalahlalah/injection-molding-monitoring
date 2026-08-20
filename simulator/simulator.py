"""Machine simulator for the injection molding monitoring prototype.

Simulates injection molding machines reporting telemetry to the backend API.
The machine list is loaded from the API, so adding a machine to the database
is enough - no code change is required here.
"""

import json
import random
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

CONFIG_PATH = Path(__file__).parent / "config.json"


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


class MachineSimulator:
    """Holds the simulated state of one machine."""

    def __init__(self, machine: dict, config: dict):
        self.machine_id = machine["machine_id"]
        self.ideal_cycle_time = float(machine["ideal_cycle_time_s"])
        self.config = config

        self.status = "RUN"
        self.shot_count = 0
        self.is_online = True

    def _next_status(self) -> str:
        """Decide the next machine status using simple probabilities."""
        cfg = self.config
        if self.status == "RUN":
            roll = random.random()
            if roll < cfg["alarm_probability"]:
                return "ALARM"
            if roll < cfg["alarm_probability"] + cfg["stop_probability"]:
                return "STOP"
            return "RUN"

        if random.random() < cfg["recovery_probability"]:
            return "RUN"
        return self.status

    def build_payload(self) -> dict:
        """Produce one telemetry reading."""
        self.status = self._next_status()

        if self.status == "RUN":
            self.shot_count += 1
            spread = self.config["cycle_time_variation_pct"] / 100
            cycle_time = round(
                self.ideal_cycle_time * random.uniform(1 - spread, 1 + spread), 2
            )
            injection_bar = round(random.uniform(800, 950), 1)
            barrel_temp = round(random.uniform(185, 198), 1)
        else:
            cycle_time = None
            injection_bar = None
            barrel_temp = round(random.uniform(150, 185), 1)

        return {
            "machine_id": self.machine_id,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "status": self.status,
            "cycle_time_s": cycle_time,
            "shot_count": self.shot_count,
            "injection_bar": injection_bar,
            "barrel_temp_c": barrel_temp,
        }


class SimulatorRunner:
    """Loads machines from the API and keeps them reporting."""

    def __init__(self, config: dict):
        self.config = config
        self.api = config["api_base_url"].rstrip("/")
        self.machines: dict[str, MachineSimulator] = {}
        self.running = True

    def refresh_machines(self):
        """Fetch the machine list from the API and add any new ones."""
        try:
            response = requests.get(f"{self.api}/api/machines", timeout=5)
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"[WARN] cannot load machine list: {exc}")
            return

        for machine in response.json():
            machine_id = machine["machine_id"]
            if machine_id not in self.machines:
                self.machines[machine_id] = MachineSimulator(machine, self.config)
                print(f"[INFO] machine added to simulation: {machine_id}")

    def send_once(self, sim: MachineSimulator):
        if not sim.is_online:
            return

        payload = sim.build_payload()
        try:
            response = requests.post(
                f"{self.api}/api/telemetry", json=payload, timeout=5
            )
            if response.status_code == 201:
                cycle = payload["cycle_time_s"]
                cycle_text = f"{cycle:.1f}s" if cycle is not None else "-"
                print(f"  {sim.machine_id}  {payload['status']:<6} cycle={cycle_text}")
            else:
                print(f"  {sim.machine_id}  REJECTED {response.status_code} {response.text}")
        except requests.RequestException as exc:
            print(f"  {sim.machine_id}  SEND FAILED: {exc}")

    def run(self):
        self.refresh_machines()
        last_refresh = time.time()

        while self.running:
            print(f"\n--- {datetime.now().strftime('%H:%M:%S')} ---")
            for sim in self.machines.values():
                self.send_once(sim)

            if time.time() - last_refresh > self.config["machine_refresh_seconds"]:
                self.refresh_machines()
                last_refresh = time.time()

            time.sleep(self.config["send_interval_seconds"])


def command_loop(runner: SimulatorRunner):
    """Let the operator control machines while the simulator is running."""
    help_text = (
        "\nCommands: alarm <id> | stop <id> | run <id> | "
        "offline <id> | online <id> | list | quit\n"
    )
    print(help_text)

    while runner.running:
        try:
            raw = input().strip()
        except EOFError:
            return
        if not raw:
            continue

        parts = raw.split()
        command = parts[0].lower()
        target = parts[1].upper() if len(parts) > 1 else None

        if command == "quit":
            runner.running = False
            return
        if command == "list":
            for sim in runner.machines.values():
                state = sim.status if sim.is_online else "OFFLINE"
                print(f"  {sim.machine_id}: {state} (shots={sim.shot_count})")
            continue

        sim = runner.machines.get(target)
        if sim is None:
            print(f"  unknown machine: {target}")
            continue

        if command in ("alarm", "stop", "run"):
            sim.status = command.upper()
            sim.is_online = True
            print(f"  {sim.machine_id} forced to {sim.status}")
        elif command == "offline":
            sim.is_online = False
            print(f"  {sim.machine_id} stopped sending data")
        elif command == "online":
            sim.is_online = True
            print(f"  {sim.machine_id} resumed sending data")
        else:
            print(help_text)


def main():
    config = load_config()
    runner = SimulatorRunner(config)

    threading.Thread(target=command_loop, args=(runner,), daemon=True).start()

    try:
        runner.run()
    except KeyboardInterrupt:
        print("\nsimulator stopped")


if __name__ == "__main__":
    main()