from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

from app.config import DATABASE_URL


def _configure_connection(conn):
    """Disable psycopg3's automatic prepared statements.

    We connect through Supabase's transaction pooler (port 6543), where a
    single server-side connection is shared across many clients between
    transactions. Prepared statements are tied to that server connection,
    so a name psycopg picks (e.g. "_pg3_2") can collide with one created by
    a different client sharing the same connection, raising
    DuplicatePreparedStatement. Setting prepare_threshold to None stops
    psycopg from preparing statements automatically.
    """
    conn.prepare_threshold = None


pool = ConnectionPool(
    conninfo=DATABASE_URL,
    min_size=1,
    max_size=5,
    kwargs={"row_factory": dict_row},
    configure=_configure_connection,
    open=False,
)


def get_connection():
    """Borrow a connection from the pool (used with a 'with' statement)."""
    return pool.connection()