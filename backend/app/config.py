
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
OFFLINE_THRESHOLD_SECONDS = int(os.getenv("OFFLINE_THRESHOLD_SECONDS", "30"))

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Check your .env file.")