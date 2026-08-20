from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

from app.config import DATABASE_URL

pool = ConnectionPool(
    conninfo=DATABASE_URL,
    min_size=1,
    max_size=5,
    kwargs={"row_factory": dict_row},
    open=False,
)


def get_connection():
    """Borrow a connection from the pool (used with a 'with' statement)."""
    return pool.connection()