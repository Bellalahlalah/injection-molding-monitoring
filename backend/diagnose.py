import socket
from urllib.parse import urlparse

import psycopg

from app.config import DATABASE_URL

url = urlparse(DATABASE_URL)

print("--- what is in .env ---")
print("user:", url.username)
print("host:", url.hostname)
print("port:", url.port)
print("password length:", len(url.password or ""))
print("password has special chars:",
      any(c in (url.password or "") for c in "@:/?#[]%&"))

print("\n--- DNS lookup ---")
try:
    print("resolved to:", socket.gethostbyname(url.hostname))
except Exception as e:
    print("DNS FAILED:", e)

print("\n--- direct connection ---")
try:
    with psycopg.connect(DATABASE_URL, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_user")
            print("CONNECTED OK ->", cur.fetchone())
except Exception as e:
    print("CONNECT FAILED:", type(e).__name__)
    print(e)