# Command Reference

Every recs command, organized by category. Click any command name for full documentation with options, examples, and usage notes.

## Input Operations

These commands create records from external data sources.

| Command | Description |
|---------|-------------|
| [fromapache](./fromapache) | Each line of input (or lines of &lt;files&gt;) is parsed to produce an output record from Apache access logs |
| [fromatomfeed](./fromatomfeed) | Produce records from atom feed entries |
| [fromcsv](./fromcsv) | Each line of input (or lines of &lt;files&gt;) is split on commas to produce an output record |
| [fromdb](./fromdb) | Execute a select statement on a database and create a record stream from the results |
| [fromjsonarray](./fromjsonarray) | Import JSON objects from within a JSON array |
| [fromkv](./fromkv) | Records are generated from character input with the form "&lt;record&gt;&lt;record-delim&gt;&lt;record&gt;..." |
| [frommongo](./frommongo) | Generate records from a MongoDB query |
| [frommultire](./frommultire) | Match multiple regexes against each line of input (or lines of &lt;files&gt;) |
| [fromps](./fromps) | Generate records from the process table |
| [fromre](./fromre) | The regex &lt;re&gt; is matched against each line of input (or lines of &lt;files&gt;) |
| [fromsplit](./fromsplit) | Each line of input (or lines of &lt;files&gt;) is split on the provided delimiter to produce an output record |
| [fromtcpdump](./fromtcpdump) | Runs tcpdump and puts out records, one for each packet |
| [fromxferlog](./fromxferlog) | Each line of input (or lines of &lt;files&gt;) is parsed as an FTP transfer log (xferlog format) to produce an output record |
| [fromxml](./fromxml) | Reads either from STDIN or from the specified URIs |

## Transform Operations

These commands reshape, filter, sort, and aggregate records.

| Command | Description |
|---------|-------------|
| [annotate](./annotate) | Evaluate an expression on each record and cache the resulting changes by key grouping |
| [assert](./assert) | Asserts that every record in the stream must pass the given expression |
| [chain](./chain) | Creates an in-memory chain of recs operations |
| [collate](./collate) | Take records, grouped together by --keys, and compute statistics (like average, count, sum, concat, etc.) within those groups. |
| [decollate](./decollate) | Reverse of collate: takes a single record and produces multiple records using deaggregators |
| [delta](./delta) | Transforms absolute values into deltas between adjacent records |
| [eval](./eval) | Evaluate an expression on each record and print the result as a line of text |
| [flatten](./flatten) | Flatten nested hash/array structures in records into top-level fields |
| [generate](./generate) | Execute an expression for each record to generate new records |
| [grep](./grep) | Filter records where an expression evaluates to true |
| [join](./join) | Join two record streams on a key |
| [multiplex](./multiplex) | Take records, grouped together by --keys, and run a separate operation instance for each group |
| [normalizetime](./normalizetime) | Given a single key field containing a date/time value, construct a normalized version of the value and place it into a field named 'n_&lt;key&gt;' |
| [sort](./sort) | Sort records from input or from files |
| [stream2table](./stream2table) | Transforms a list of records, combining records based on a column field |
| [substream](./substream) | Filter to a range of records delimited from when the begin snippet becomes true to when the end snippet becomes true, i.e |
| [topn](./topn) | Output the top N records from the input stream or from files |
| [xform](./xform) | Transform records with a JS snippet |

## Output Operations

These commands render records into human-readable or machine-readable formats.

| Command | Description |
|---------|-------------|
| [tocsv](./tocsv) | Outputs records as CSV formatted lines |
| [todb](./todb) | Dumps a stream of input records into a database |
| [togdgraph](./togdgraph) | Create a bar, scatter, or line graph |
| [tognuplot](./tognuplot) | Create a graph of points from a record stream using GNU Plot |
| [tohtml](./tohtml) | Prints out an HTML table for the records from input or from files. |
| [tojsonarray](./tojsonarray) | Outputs the record stream as a single JSON array |
| [toprettyprint](./toprettyprint) | Pretty print records, one key to a line, with a line of dashes separating records |
| [toptable](./toptable) | Creates a multi-dimensional pivot table with any number of x and y axes |
| [totable](./totable) | Pretty prints a table of records to the screen |
