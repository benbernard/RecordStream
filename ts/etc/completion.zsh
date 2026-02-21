#compdef recs
# Zsh completion for recs (RecordStream)
# Source this file or place in your fpath:
#   fpath=(/path/to/dir $fpath); autoload -Uz compinit && compinit

_recs() {
  local -a subcommands
  subcommands=(
    'fromapache:Parse Apache log files into records'
    'fromatomfeed:Parse Atom/RSS feeds into records'
    'fromcsv:Parse CSV files into records'
    'fromdb:Query SQLite databases into records'
    'fromjsonarray:Parse a JSON array into records'
    'fromkv:Parse key-value pairs into records'
    'frommongo:Query MongoDB into records'
    'frommultire:Parse multi-line records with multiple regexes'
    'fromps:Parse process table into records'
    'fromre:Parse lines matching a regex into records'
    'fromsplit:Split delimited text into records'
    'fromtcpdump:Parse tcpdump output into records'
    'fromxferlog:Parse xferlog files into records'
    'fromxml:Parse XML into records'
    'annotate:Add running statistics to records'
    'assert:Assert an expression against each record'
    'chain:Chain multiple recs operations in sequence'
    'collate:Aggregate records by key'
    'decollate:Expand aggregated records back out'
    'delta:Compute deltas between consecutive records'
    'eval:Evaluate a snippet against each record'
    'flatten:Flatten nested record structures'
    'generate:Generate new records from a snippet'
    'grep:Filter records matching an expression'
    'join:Join two record streams'
    'multiplex:Run operations on substreams grouped by key'
    'normalizetime:Normalize time fields to epoch seconds'
    'sort:Sort records by key'
    'stream2table:Pivot a record stream into a table'
    'substream:Select a sub-range of the record stream'
    'topn:Select top N records by key'
    'xform:Transform records with snippets'
    'tocsv:Output records as CSV'
    'todb:Insert records into a SQLite database'
    'togdgraph:Output records as a GD::Graph chart'
    'tognuplot:Output records as a gnuplot chart'
    'tohtml:Output records as an HTML table'
    'tojsonarray:Output records as a JSON array'
    'toprettyprint:Pretty-print records'
    'toptable:Output records as a pivot table'
    'totable:Output records as a text table'
    'help:Show help for a command'
  )

  if (( CURRENT == 2 )); then
    _describe -t subcommands 'recs command' subcommands
    return
  fi

  local cmd="${words[2]}"

  case "$cmd" in
    fromapache)
      _arguments \
        '--fast[Fast parsing mode]' \
        '--strict[Strict parsing mode]' \
        '--verbose[Verbose output]' \
        '*:file:_files'
      ;;
    fromatomfeed)
      _arguments \
        '--follow[Follow pagination links]' \
        '--nofollow[Do not follow pagination links]' \
        '--max[Maximum number of entries]:count' \
        '*:file:_files'
      ;;
    fromcsv)
      _arguments \
        '(--key -k)'{--key,-k}'[Key name for column]:key' \
        '(--field -f)'{--field,-f}'[Field name for column]:field' \
        '--header[First line is header]' \
        '--strict[Strict CSV parsing]' \
        '(--delim -d)'{--delim,-d}'[Field delimiter]:delimiter' \
        '--escape[Escape character]:char' \
        '--quote[Quote character]:char' \
        '*:file:_files'
      ;;
    fromdb)
      _arguments \
        '--table[Table name]:table' \
        '--sql[SQL query]:query' \
        '--dbfile[Database file]:file:_files' \
        '--type[Database type]:type'
      ;;
    fromjsonarray)
      _arguments \
        '(--key -k)'{--key,-k}'[Key name]:key' \
        '*:file:_files'
      ;;
    fromkv)
      _arguments \
        '(--kv-delim -f)'{--kv-delim,-f}'[Key-value delimiter]:delimiter' \
        '(--entry-delim -e)'{--entry-delim,-e}'[Entry delimiter]:delimiter' \
        '(--record-delim -r)'{--record-delim,-r}'[Record delimiter]:delimiter' \
        '*:file:_files'
      ;;
    frommongo)
      _arguments \
        '--host[MongoDB host]:host' \
        '--user[Username]:user' \
        '(--password --pass)'{--password,--pass}'[Password]:password' \
        '(--name --dbname)'{--name,--dbname}'[Database name]:database' \
        '--collection[Collection name]:collection' \
        '--query[Query JSON]:query'
      ;;
    frommultire)
      _arguments \
        '--no-flush-regex[Regex that does not flush]:regex' \
        '(--regex --re)'{--regex,--re}'[Regex pattern]:regex' \
        '(--pre-flush-regex --pre)'{--pre-flush-regex,--pre}'[Pre-flush regex]:regex' \
        '(--post-flush-regex --post)'{--post-flush-regex,--post}'[Post-flush regex]:regex' \
        '(--double-flush-regex --double)'{--double-flush-regex,--double}'[Double-flush regex]:regex' \
        '--clobber[Overwrite existing keys]' \
        '(--keep-all --keep)'{--keep-all,--keep}'[Keep all values]' \
        '*:file:_files'
      ;;
    fromps)
      _arguments \
        '(--key -k)'{--key,-k}'[Key name]:key' \
        '(--field -f)'{--field,-f}'[Field name]:field'
      ;;
    fromre)
      _arguments \
        '(--key -k)'{--key,-k}'[Key name for capture group]:key' \
        '(--field -f)'{--field,-f}'[Field name]:field' \
        '*:file:_files'
      ;;
    fromsplit)
      _arguments \
        '(--delim -d)'{--delim,-d}'[Field delimiter]:delimiter' \
        '(--key -k)'{--key,-k}'[Key name]:key' \
        '(--field -f)'{--field,-f}'[Field name]:field' \
        '--header[First line is header]' \
        '--strict[Strict parsing]' \
        '*:file:_files'
      ;;
    fromtcpdump)
      _arguments \
        '--data[Include packet data]' \
        '*:file:_files'
      ;;
    fromxferlog)
      _arguments \
        '*:file:_files'
      ;;
    fromxml)
      _arguments \
        '--element[Element to extract]:element' \
        '--nested[Allow nested elements]' \
        '*:file:_files'
      ;;
    annotate)
      _arguments \
        '(--keys -k)'{--keys,-k}'[Keys to annotate]:key' \
        '*:file:_files'
      ;;
    assert)
      _arguments \
        '(--diagnostic -d)'{--diagnostic,-d}'[Diagnostic message]:message' \
        '(--verbose -v)'{--verbose,-v}'[Verbose output]' \
        '*:file:_files'
      ;;
    chain)
      _arguments \
        '--show-chain[Show the chain of operations]' \
        '(--dry-run -n)'{--dry-run,-n}'[Dry run without executing]'
      ;;
    collate)
      _arguments \
        '(--key -k)'{--key,-k}'[Key to group by]:key' \
        '(--aggregator -a)'{--aggregator,-a}'[Aggregator specification]:aggregator' \
        '(--incremental -i)'{--incremental,-i}'[Incremental aggregation]' \
        '--bucket[Bucket mode]' \
        '--no-bucket[Disable bucket mode]' \
        '--adjacent[Adjacent grouping only]' \
        '(--size -n)'{--size,-n}'[LRU key window size]:size' \
        '--cube[Enable cube mode]' \
        '--list-aggregators[List available aggregators]' \
        '*:file:_files'
      ;;
    decollate)
      _arguments \
        '(--deaggregator -d)'{--deaggregator,-d}'[Deaggregator specification]:deaggregator' \
        '--list-deaggregators[List available deaggregators]' \
        '*:file:_files'
      ;;
    delta)
      _arguments \
        '(--key -k)'{--key,-k}'[Key to compute delta on]:key' \
        '*:file:_files'
      ;;
    eval)
      _arguments \
        '--chomp[Chomp trailing newlines]' \
        '*:file:_files'
      ;;
    flatten)
      _arguments \
        '--depth[Maximum flatten depth]:depth' \
        '(--key -k)'{--key,-k}'[Key to flatten]:key' \
        '--deep[Deep flatten]' \
        '--separator[Key separator]:separator' \
        '*:file:_files'
      ;;
    generate)
      _arguments \
        '--keychain[Keychain mode]' \
        '--passthrough[Pass through original records]' \
        '*:file:_files'
      ;;
    grep)
      _arguments \
        '(--invert-match -v)'{--invert-match,-v}'[Invert match]' \
        '(--context -C)'{--context,-C}'[Context lines]:lines' \
        '(--after-context -A)'{--after-context,-A}'[After context lines]:lines' \
        '(--before-context -B)'{--before-context,-B}'[Before context lines]:lines' \
        '*:file:_files'
      ;;
    join)
      _arguments \
        '--left[Left join]' \
        '--right[Right join]' \
        '--inner[Inner join]' \
        '--outer[Outer join]' \
        '--operation[Join operation]:operation' \
        '--accumulate-right[Accumulate right side records]' \
        '*:file:_files'
      ;;
    multiplex)
      _arguments \
        '(--key -k)'{--key,-k}'[Key to group by]:key' \
        '(--line-key -L)'{--line-key,-L}'[Line key]:key' \
        '--adjacent[Adjacent grouping only]' \
        '--size[LRU key window size]:size' \
        '--cube[Enable cube mode]' \
        '*:file:_files'
      ;;
    normalizetime)
      _arguments \
        '(--key -k)'{--key,-k}'[Time field key]:key' \
        '(--threshold -n)'{--threshold,-n}'[Threshold]:threshold' \
        '(--epoch -e)'{--epoch,-e}'[Epoch format]' \
        '(--strict -s)'{--strict,-s}'[Strict parsing]' \
        '*:file:_files'
      ;;
    sort)
      _arguments \
        '(--key -k)'{--key,-k}'[Sort key]:key' \
        '(--reverse -r)'{--reverse,-r}'[Reverse sort order]' \
        '*:file:_files'
      ;;
    stream2table)
      _arguments \
        '(--field -f)'{--field,-f}'[Field to pivot on]:field' \
        '*:file:_files'
      ;;
    substream)
      _arguments \
        '(--begin -b)'{--begin,-b}'[Begin expression]:expression' \
        '(--end -e)'{--end,-e}'[End expression]:expression' \
        '*:file:_files'
      ;;
    topn)
      _arguments \
        '(--key -k)'{--key,-k}'[Key to rank by]:key' \
        '(--topn -n)'{--topn,-n}'[Number of top records]:count' \
        '--delimiter[Output delimiter]:delimiter' \
        '*:file:_files'
      ;;
    xform)
      _arguments \
        '(--before -B)'{--before,-B}'[Before snippet]:snippet' \
        '(--after -A)'{--after,-A}'[After snippet]:snippet' \
        '(--context -C)'{--context,-C}'[Context snippet]:snippet' \
        '--post-snippet[Post snippet]:snippet' \
        '--pre-snippet[Pre snippet]:snippet' \
        '*:file:_files'
      ;;
    tocsv)
      _arguments \
        '(--key -k)'{--key,-k}'[Output key]:key' \
        '(--noheader --nh)'{--noheader,--nh}'[Omit CSV header]' \
        '(--delim -d)'{--delim,-d}'[Field delimiter]:delimiter' \
        '*:file:_files'
      ;;
    todb)
      _arguments \
        '--drop[Drop table before insert]' \
        '--table[Table name]:table' \
        '--debug[Debug SQL output]' \
        '(--key -k)'{--key,-k}'[Key to insert]:key' \
        '(--fields -f)'{--fields,-f}'[Fields to insert]:fields' \
        '--dbfile[Database file]:file:_files' \
        '--type[Database type]:type' \
        '*:file:_files'
      ;;
    togdgraph)
      _arguments \
        '(--key -k)'{--key,-k}'[Key for x-axis]:key' \
        '(--fields -f)'{--fields,-f}'[Fields to plot]:fields' \
        '(--option -o)'{--option,-o}'[Graph option]:option' \
        '--label-x[X-axis label]:label' \
        '--label-y[Y-axis label]:label' \
        '--graph-title[Graph title]:title' \
        '--png-file[Output PNG file]:file:_files' \
        '--type[Graph type]:type' \
        '--width[Graph width]:width' \
        '--height[Graph height]:height' \
        '--dump-use-spec[Dump use specification]'
      ;;
    tognuplot)
      _arguments \
        '(--key -k)'{--key,-k}'[Key for x-axis]:key' \
        '(--fields -f)'{--fields,-f}'[Fields to plot]:fields' \
        '--using[Gnuplot using clause]:using' \
        '--plot[Plot command]:plot' \
        '--precommand[Pre-plot command]:command' \
        '--title[Plot title]:title' \
        '--label[Axis label]:label' \
        '--file[Output file]:file:_files' \
        '--lines[Use lines]' \
        '--bargraph[Use bar graph]' \
        '--gnuplot-command[Gnuplot binary]:command' \
        '--dump-to-screen[Dump commands to screen]'
      ;;
    tohtml)
      _arguments \
        '(--keys -k --key)'{--keys,-k,--key}'[Keys to output]:key' \
        '(--fields -f)'{--fields,-f}'[Fields to output]:field' \
        '--noheader[Omit HTML header]' \
        '(--rowattributes --row)'{--rowattributes,--row}'[Row attributes]:attributes' \
        '(--cellattributes --cell)'{--cellattributes,--cell}'[Cell attributes]:attributes' \
        '*:file:_files'
      ;;
    tojsonarray)
      _arguments \
        '*:file:_files'
      ;;
    toprettyprint)
      _arguments \
        '(--1 --one)'{--1,--one}'[One record per page]' \
        '--n[Number of records]:count' \
        '(--keys -k)'{--keys,-k}'[Keys to display]:key' \
        '--nonested[Skip nested values]' \
        '--aligned[Align output columns]' \
        '*:file:_files'
      ;;
    toptable)
      _arguments \
        '(--x-field -x)'{--x-field,-x}'[X-axis field]:field' \
        '(--y-field -y)'{--y-field,-y}'[Y-axis field]:field' \
        '(--v-field -v)'{--v-field,-v}'[Value field]:field' \
        '(--pin -p)'{--pin,-p}'[Pin a field value]:value' \
        '--sort[Sort output]' \
        '--noheaders[Omit headers]' \
        '(--records --recs)'{--records,--recs}'[Output as records]' \
        '(--sort-all-to-end --sa)'{--sort-all-to-end,--sa}'[Sort all to end]' \
        '*:file:_files'
      ;;
    totable)
      _arguments \
        '(--no-header -n)'{--no-header,-n}'[Omit header row]' \
        '(--key -k)'{--key,-k}'[Key to display]:key' \
        '(--field -f)'{--field,-f}'[Field to display]:field' \
        '(--spreadsheet -s)'{--spreadsheet,-s}'[Spreadsheet mode]' \
        '(--delim -d)'{--delim,-d}'[Column delimiter]:delimiter' \
        '--clear[Clear screen before output]' \
        '*:file:_files'
      ;;
    help)
      _describe -t subcommands 'recs command' subcommands
      ;;
  esac
}

_recs "$@"
