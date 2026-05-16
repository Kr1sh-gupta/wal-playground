const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB,
});

// Live WAL position & stats
app.get('/api/wal/status', async (req, res) => {
  const r = await pool.query(`
    SELECT
      pg_current_wal_lsn()            AS current_lsn,
      pg_walfile_name(pg_current_wal_lsn()) AS wal_file,
      pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') AS bytes_written,
      (SELECT count(*) FROM pg_stat_replication) AS replication_slots
  `);
  res.json(r.rows[0]);
});

// WAL files on disk
app.get('/api/wal/files', async (req, res) => {
  const r = await pool.query(`
    SELECT name, size, modification
    FROM pg_ls_waldir()
    ORDER BY modification DESC
    LIMIT 20
  `);
  res.json(r.rows);
});

// Recent WAL activity via pg_stat_bgwriter + checkpoints
app.get('/api/wal/checkpoints', async (req, res) => {
  const r = await pool.query(`
    SELECT
      checkpoints_timed,
      checkpoints_req,
      checkpoint_write_time,
      checkpoint_sync_time,
      buffers_checkpoint,
      buffers_clean,
      buffers_backend,
      stats_reset
    FROM pg_stat_bgwriter
  `);
  res.json(r.rows[0]);
});

// Recent transactions touching WAL (from pg_stat_activity + pg_locks)
app.get('/api/wal/transactions', async (req, res) => {
  const r = await pool.query(`
    SELECT
      xact_start,
      query_start,
      state,
      left(query, 80) AS query,
      wait_event_type,
      wait_event
    FROM pg_stat_activity
    WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
    ORDER BY xact_start DESC
    LIMIT 20
  `);
  res.json(r.rows);
});

// Run a demo transaction and see WAL advance
app.post('/api/demo/transaction', async (req, res) => {
  const { type } = req.body;
  const before = await pool.query(`SELECT pg_current_wal_lsn() AS lsn`);

  if (type === 'insert') {
    await pool.query(`
      INSERT INTO orders (product, amount, status)
      VALUES ('Widget A', $1, 'pending')
    `, [Math.floor(Math.random() * 200) + 10]);
  } else if (type === 'update') {
    await pool.query(`
      UPDATE orders SET status = 'shipped'
      WHERE id = (SELECT id FROM orders WHERE status='pending' LIMIT 1)
    `);
  } else if (type === 'delete') {
    await pool.query(`
      DELETE FROM orders
      WHERE id = (SELECT id FROM orders ORDER BY id LIMIT 1)
    `);
  } else if (type === 'abort') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO orders (product, amount) VALUES ('Ghost', 999)`);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  const after = await pool.query(`SELECT pg_current_wal_lsn() AS lsn`);
  const diff = await pool.query(
    `SELECT pg_wal_lsn_diff($1::pg_lsn, $2::pg_lsn) AS bytes_generated`,
    [after.rows[0].lsn, before.rows[0].lsn]
  );

  res.json({
    before_lsn: before.rows[0].lsn,
    after_lsn: after.rows[0].lsn,
    wal_bytes_generated: diff.rows[0].bytes_generated,
    operation: type
  });
});

// Table data
app.get('/api/tables/orders', async (req, res) => {
  const r = await pool.query(`SELECT * FROM orders ORDER BY id DESC LIMIT 20`);
  res.json(r.rows);
});

app.get('/api/tables/inventory', async (req, res) => {
  const r = await pool.query(`SELECT * FROM inventory ORDER BY product_id`);
  res.json(r.rows);
});

// WAL record inspector using pg_walinspect
app.get('/api/wal/records', async (req, res) => {
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_walinspect`);
      const r = await pool.query(`
        SELECT
          start_lsn AS lsn,
          xid,
          resource_manager AS rmgr,
          record_type,
          record_length,
          main_data_length,
          fpi_length,
          description
        FROM pg_get_wal_records_info(
          (SELECT checkpoint_lsn FROM pg_control_checkpoint()),
          pg_current_wal_lsn()
        )
        ORDER BY start_lsn DESC
        LIMIT 50
      `);
      res.json(r.rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  
app.listen(3000, () => console.log('WAL Viewer running on :3000'));