# frommongo

Query a MongoDB collection and produce records from the results.

## Synopsis

```bash
recs frommongo --host <URI> --name <DB> --collection <COLLECTION> --query <QUERY>
```

## Description

`frommongo` connects to a MongoDB instance, runs a query against a collection, and emits one record per matching document. It is the bridge between your MongoDB data and the rest of the recs pipeline.

The command requires four pieces of information: the host URI, the database name, the collection name, and a query. The query is a JSON string using MongoDB query syntax. Relaxed JSON is accepted -- bare keys, single quotes, and trailing commas are handled gracefully, so you can type queries the same way you would in the `mongo` shell without worrying about strict JSON quoting.

Authentication credentials can be embedded in the host URI (the MongoDB standard `mongodb://user:pass@host:port` format) or supplied separately with `--user` and `--password`. ObjectId values in the `_id` field are automatically converted to strings for downstream compatibility.

## Options

| Flag | Description |
|------|-------------|
| `--host <URI>` | MongoDB connection URI. May include credentials (e.g., `mongodb://user:pass@host:port`). |
| `--user <USER>` | Username for authentication. |
| `--password <PASSWORD>` | Password for authentication. Also accepts `--pass`. |
| `--name <DB_NAME>` | Name of the database to connect to. Also accepts `--dbname`. |
| `--collection <COLLECTION>` | Name of the collection to query. |
| `--query <QUERY>` | MongoDB query as a JSON string. Supports relaxed JSON (bare keys, single quotes). |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

All of `--host`, `--name`, `--collection`, and `--query` are required.

## Examples

### Query all documents in a collection
```bash
recs frommongo \
  --host mongodb://localhost:27017 \
  --name myapp \
  --collection users \
  --query '{}'
```

### Find active users with a specific role
```bash
recs frommongo \
  --host mongodb://localhost:27017 \
  --name myapp \
  --collection users \
  --query '{active: true, role: "admin"}'
```

### Query a remote MongoDB instance with authentication
```bash
recs frommongo \
  --host mongodb://user:pass@db.example.com:27017 \
  --name production \
  --collection orders \
  --query '{status: {$ne: "cancelled"}}' \
  | recs collate --key status --aggregator count
```

### Use separate auth flags
```bash
recs frommongo \
  --host mongodb://db.example.com:27017 \
  --user readonly \
  --password secret123 \
  --name analytics \
  --collection events \
  --query '{timestamp: {$gt: "2026-01-01"}}'
```

### Find documents where an array field is non-empty
```bash
recs frommongo \
  --host mongodb://localhost:27017 \
  --name myapp \
  --collection products \
  --query '{tags: {$not: {$size: 0}}}'
```

## Notes

- This command requires the `mongodb` npm package as an optional peer dependency. Install it with `bun add mongodb` or `npm install mongodb`.
- MongoDB operations are inherently asynchronous. Use the async pipeline API for best results.
- ObjectId `_id` fields are automatically converted to string representations.

## See Also

- [fromdb](./fromdb) - Query SQLite databases
- [fromjsonarray](./fromjsonarray) - Parse JSON data exports from MongoDB
