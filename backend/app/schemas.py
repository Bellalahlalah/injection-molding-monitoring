from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class TelemetryIn(BaseModel):
    """One data point sent by a machine (or the simulator)."""

    machine_id: str = Field(..., min_length=1, max_length=20)
    recorded_at: datetime
    status: Literal["RUN", "STOP", "ALARM"]
    cycle_time_s: Optional[float] = Field(None, ge=0, le=600)
    shot_count: Optional[int] = Field(None, ge=0)
    injection_bar: Optional[float] = Field(None, ge=0, le=3000)
    barrel_temp_c: Optional[float] = Field(None, ge=0, le=500)
    job_number: Optional[str] = None