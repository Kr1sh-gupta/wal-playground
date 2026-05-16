# PostgreSQL WAL Playground 🚀

Welcome to the WAL Playground! This project is designed to help you understand and visualize **Write-Ahead Logging (WAL)** in PostgreSQL.

## What is WAL (Write-Ahead Logging)?

**WAL** is a standard method for ensuring data integrity and durability. In simple terms:
1. Before any changes (INSERT, UPDATE, DELETE) are applied to the actual data files on disk, they are first described and written to a "log" (the WAL).
2. If the database crashes, it can replay this log to recover all changes that were committed but not yet written to the data pages.

### Key Concepts in this Lab:
- **LSN (Log Sequence Number)**: A unique identifier for a position in the WAL. It grows as more activity happens.
- **Checkpoints**: Occasional events where PostgreSQL flushes all dirty data in memory to disk and marks the WAL as "safe" up to that point.
- **WAL Segments**: Physical files (usually 16MB) in the `pg_wal` directory where log records are stored.
- **Logical Decoding**: Using WAL to extract changes in a readable format (enabled via `wal_level=logical` in this lab).

---

## Project Structure

- **`postgres`**: The database engine, configured with logical WAL and frequent checkpoints for learning.
- **`wal-viewer`**: A custom Node.js application (Port 3000) that decodes and displays live WAL records using the `pg_walinspect` extension.
- **`pgAdmin`**: A GUI for exploring the database tables (Port 5050).

---

## How to Operate

### 1. Start the Playground
Run this command to build the viewer and start all containers in the background:
```bash
docker compose up -d --build
```

### 2. Access the Dashboard
Open your browser and go to:
👉 **[http://localhost:3000](http://localhost:3000)**

### 3. See WAL in Action
1. Go to the **Dashboard** tab.
2. Note the current **LSN**.
3. Click on **"INSERT order"** or **"UPDATE"**.
4. Watch the **LSN advance** and see exactly how many bytes of WAL were generated for that single operation.
5. Go to the **WAL Records** tab to see the low-level decoded records (e.g., `Heap/INSERT`, `Transaction/COMMIT`).

---

## Maintenance & Cleanup

When you are done learning, use the following commands to clean up your environment.

### Stop the Lab
Stop the containers but keep the data and images:
```bash
docker compose stop
```

### Clean Up Containers & Network
Stop and remove the containers and the internal network:
```bash
docker compose down
```

### Full Reset (Remove Data & Images)
If you want to completely wipe the database data and the built images to start fresh next time:
```bash
docker compose down -v --rmi local
```
- `-v`: Removes the persistent volume (`pg_data`) where the database is stored.
- `--rmi local`: Removes the locally built `wal-viewer` image.

---

## Troubleshooting

If you see errors related to `pg_get_wal_records_info`, ensure you are using **PostgreSQL 15 or 16**. This lab is configured to use **Postgres 16**, where some column names (like `start_lsn`) differ from earlier versions of the `pg_walinspect` extension.
