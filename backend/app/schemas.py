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
    good_increment: int = Field(0, ge=0, le=100)
    reject_increment: int = Field(0, ge=0, le=100)


class AlarmIn(BaseModel):
    """An alarm raised by a machine."""

    machine_id: str = Field(..., min_length=1, max_length=20)
    alarm_code: str = Field(..., min_length=1, max_length=20)
    alarm_message: str = Field(..., min_length=1, max_length=200)
    severity: Literal["WARNING", "CRITICAL"] = "WARNING"
    occurred_at: datetime


class AlarmClearIn(BaseModel):
    """Request to clear active alarms on a machine."""

    machine_id: str = Field(..., min_length=1, max_length=20)
    alarm_code: Optional[str] = None
    cleared_at: datetime