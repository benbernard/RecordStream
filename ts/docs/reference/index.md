# Command Reference

Every recs command, organized by category. Click any command name for full documentation with options, examples, and usage notes.

## Input Operations

These commands create records from external data sources.

| Command | Description |
|---------|-------------|
| [fromapache](./fromapache) | Parse Apache/CLF access logs into records |
| [fromatomfeed](./fromatomfeed) | Parse Atom/RSS feed XML into records |
| [fromcsv](./fromcsv) | Parse CSV/TSV text into records |
| [fromdb](./fromdb) | Query a SQLite database into records |
| [fromjsonarray](./fromjsonarray) | Parse a JSON array into individual records |
| [fromkv](./fromkv) | Parse key-value pair lines into records |
| [frommongo](./frommongo) | Query a MongoDB collection into records |
| [frommultire](./frommultire) | Parse lines using multiple regexes into records |
| [fromps](./fromps) | Get current system processes as records |
| [fromre](./fromre) | Parse lines using a single regex into records |
| [fromsplit](./fromsplit) | Split lines on a delimiter into records |
| [fromtcpdump](./fromtcpdump) | Parse tcpdump output into records |
| [fromxferlog](./fromxferlog) | Parse FTP xferlog entries into records |
| [fromxml](./fromxml) | Parse XML documents into records |

## Transform Operations

These commands reshape, filter, sort, and aggregate records.

| Command | Description |
|---------|-------------|
| [annotate](./annotate) | Add running aggregation values to each record |
| [assert](./assert) | Abort the pipeline if a condition fails |
| [chain](./chain) | Run records through a sub-pipeline |
| [collate](./collate) | Group records and compute aggregate statistics |
| [decollate](./decollate) | Expand aggregated fields back into individual records |
| [delta](./delta) | Compute differences between consecutive records |
| [eval](./eval) | Evaluate a snippet and output its result as a line |
| [flatten](./flatten) | Flatten nested record structures |
| [generate](./generate) | Generate new records from a snippet |
| [grep](./grep) | Filter records by a predicate expression |
| [join](./join) | Join two record streams on a common key |
| [multiplex](./multiplex) | Send records to multiple sub-pipelines based on conditions |
| [normalizetime](./normalizetime) | Normalize time fields to a standard format |
| [sort](./sort) | Sort records by one or more keys |
| [stream2table](./stream2table) | Convert a record stream to a 2D table structure |
| [substream](./substream) | Process sub-groups of records independently |
| [topn](./topn) | Keep only the top N records per group |
| [xform](./xform) | Transform records with an arbitrary snippet |

## Output Operations

These commands render records into human-readable or machine-readable formats.

| Command | Description |
|---------|-------------|
| [tocsv](./tocsv) | Output records as CSV |
| [todb](./todb) | Insert records into a SQLite database |
| [togdgraph](./togdgraph) | Output records as a Google Charts graph |
| [tognuplot](./tognuplot) | Output records as a gnuplot chart |
| [tohtml](./tohtml) | Output records as an HTML table |
| [tojsonarray](./tojsonarray) | Output records as a JSON array |
| [toprettyprint](./toprettyprint) | Pretty-print records as formatted JSON |
| [toptable](./toptable) | Output records as a 2D pivot table |
| [totable](./totable) | Output records as a formatted ASCII table |
