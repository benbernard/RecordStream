# frommongo

Generate records from a MongoDB query.

## Synopsis

```bash
recs frommongo --host <URI> --name <DB> --collection <COLL> --query <QUERY>
```

## Description

Generate records from a MongoDB query. Connects to a MongoDB instance, runs the specified query against the given collection, and outputs each matching document as a record.

## Options

| Flag | Description |
|------|-------------|
| `--host` `<HOST_URI>` | URI for your mongo instance, may include user:pass@URI. **(required)** |
| `--user` `<USER>` | User to authenticate as. |
| `--password` / `--pass` `<PASSWORD>` | Password for --user. |
| `--name` / `--dbname` `<DB_NAME>` | Name of database to connect to. **(required)** |
| `--collection` `<COLLECTION_NAME>` | Name of collection to query against. **(required)** |
| `--query` `<QUERY>` | JSON query string to run against the collection. **(required)** |

## Examples

### Make a query against a MongoDB instance
```bash
recs frommongo --host mongodb://user:pass@dharma.mongohq.com:10069 --name my_app --collection my_collection --query '{doc_key: {$not: {$size: 0}}}'
```
