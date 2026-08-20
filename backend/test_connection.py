#testing file temporary#

from app.db import pool

pool.open()

with pool.connection() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT machine_id, machine_name, brand FROM machines ORDER BY machine_id")
        for row in cur.fetchall():
            print(row)

pool.close()
print("Connection OK")