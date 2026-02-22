#!/bin/bash
# Bash completion for recs (RecordStream)
# Source this file in your .bashrc:
#   source /path/to/completion.bash

_recs() {
  local cur prev recs_cmd
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  # All known subcommands
  local subcommands="annotate assert chain collate decollate delta eval flatten fromapache fromatomfeed fromcsv fromdb fromjsonarray fromkv frommongo frommultire fromps fromre fromsplit fromtcpdump fromxferlog fromxml generate grep join multiplex normalizetime sort stream2table substream tocsv todb togdgraph tognuplot tohtml tojsonarray topn toprettyprint toptable totable xform"

  # Complete the subcommand (first argument)
  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$subcommands help --help -h --version -V" -- "$cur") )
    return 0
  fi

  recs_cmd="${COMP_WORDS[1]}"

  # Complete flags per subcommand
  case "$recs_cmd" in
    fromapache)
      COMPREPLY=( $(compgen -W "--fast --strict --verbose" -- "$cur") )
      ;;
    fromatomfeed)
      COMPREPLY=( $(compgen -W "--follow --nofollow --max" -- "$cur") )
      ;;
    fromcsv)
      COMPREPLY=( $(compgen -W "--key -k --field -f --header --strict --delim -d --escape --quote" -- "$cur") )
      ;;
    fromdb)
      COMPREPLY=( $(compgen -W "--table --sql --dbfile --type" -- "$cur") )
      ;;
    fromjsonarray)
      COMPREPLY=( $(compgen -W "--key -k" -- "$cur") )
      ;;
    fromkv)
      COMPREPLY=( $(compgen -W "--kv-delim -f --entry-delim -e --record-delim -r" -- "$cur") )
      ;;
    frommongo)
      COMPREPLY=( $(compgen -W "--host --user --password --pass --name --dbname --collection --query" -- "$cur") )
      ;;
    frommultire)
      COMPREPLY=( $(compgen -W "--no-flush-regex --regex --re --pre-flush-regex --pre --post-flush-regex --post --double-flush-regex --double --clobber --keep-all --keep" -- "$cur") )
      ;;
    fromps)
      COMPREPLY=( $(compgen -W "--key -k --field -f" -- "$cur") )
      ;;
    fromre)
      COMPREPLY=( $(compgen -W "--key -k --field -f" -- "$cur") )
      ;;
    fromsplit)
      COMPREPLY=( $(compgen -W "--delim -d --key -k --field -f --header --strict" -- "$cur") )
      ;;
    fromtcpdump)
      COMPREPLY=( $(compgen -W "--data" -- "$cur") )
      ;;
    fromxferlog)
      COMPREPLY=()
      ;;
    fromxml)
      COMPREPLY=( $(compgen -W "--element --nested" -- "$cur") )
      ;;
    annotate)
      COMPREPLY=( $(compgen -W "--keys -k" -- "$cur") )
      ;;
    assert)
      COMPREPLY=( $(compgen -W "--diagnostic -d --verbose -v" -- "$cur") )
      ;;
    chain)
      COMPREPLY=( $(compgen -W "--show-chain --dry-run -n" -- "$cur") )
      ;;
    collate)
      COMPREPLY=( $(compgen -W "--key -k --aggregator -a --incremental -i --bucket --no-bucket --adjacent --size -n --cube --list-aggregators" -- "$cur") )
      ;;
    decollate)
      COMPREPLY=( $(compgen -W "--deaggregator -d --list-deaggregators" -- "$cur") )
      ;;
    delta)
      COMPREPLY=( $(compgen -W "--key -k" -- "$cur") )
      ;;
    eval)
      COMPREPLY=( $(compgen -W "--chomp" -- "$cur") )
      ;;
    flatten)
      COMPREPLY=( $(compgen -W "--depth --key -k --deep --separator" -- "$cur") )
      ;;
    generate)
      COMPREPLY=( $(compgen -W "--keychain --passthrough" -- "$cur") )
      ;;
    grep)
      COMPREPLY=( $(compgen -W "--invert-match -v --context -C --after-context -A --before-context -B" -- "$cur") )
      ;;
    join)
      COMPREPLY=( $(compgen -W "--left --right --inner --outer --operation --accumulate-right" -- "$cur") )
      ;;
    multiplex)
      COMPREPLY=( $(compgen -W "--key -k --line-key -L --adjacent --size --cube" -- "$cur") )
      ;;
    normalizetime)
      COMPREPLY=( $(compgen -W "--key -k --threshold -n --epoch -e --strict -s" -- "$cur") )
      ;;
    sort)
      COMPREPLY=( $(compgen -W "--key -k --reverse -r" -- "$cur") )
      ;;
    stream2table)
      COMPREPLY=( $(compgen -W "--field -f" -- "$cur") )
      ;;
    substream)
      COMPREPLY=( $(compgen -W "--begin -b --end -e" -- "$cur") )
      ;;
    topn)
      COMPREPLY=( $(compgen -W "--key -k --topn -n --delimiter" -- "$cur") )
      ;;
    xform)
      COMPREPLY=( $(compgen -W "--before -B --after -A --context -C --post-snippet --pre-snippet" -- "$cur") )
      ;;
    tocsv)
      COMPREPLY=( $(compgen -W "--key -k --noheader --nh --delim -d" -- "$cur") )
      ;;
    todb)
      COMPREPLY=( $(compgen -W "--drop --table --debug --key -k --fields -f --dbfile --type" -- "$cur") )
      ;;
    togdgraph)
      COMPREPLY=( $(compgen -W "--key -k --fields -f --option -o --label-x --label-y --graph-title --png-file --type --width --height --dump-use-spec" -- "$cur") )
      ;;
    tognuplot)
      COMPREPLY=( $(compgen -W "--key -k --fields -f --using --plot --precommand --title --label --file --lines --bargraph --gnuplot-command --dump-to-screen" -- "$cur") )
      ;;
    tohtml)
      COMPREPLY=( $(compgen -W "--keys -k --key --fields -f --noheader --rowattributes --row --cellattributes --cell" -- "$cur") )
      ;;
    tojsonarray)
      COMPREPLY=()
      ;;
    toprettyprint)
      COMPREPLY=( $(compgen -W "--1 --one --n --keys -k --nonested --aligned" -- "$cur") )
      ;;
    toptable)
      COMPREPLY=( $(compgen -W "--x-field -x --y-field -y --v-field -v --pin -p --sort --noheaders --records --recs --sort-all-to-end --sa" -- "$cur") )
      ;;
    totable)
      COMPREPLY=( $(compgen -W "--no-header -n --key -k --field -f --spreadsheet -s --delim -d --clear" -- "$cur") )
      ;;
    help)
      COMPREPLY=( $(compgen -W "$subcommands" -- "$cur") )
      ;;
  esac

  return 0
}

complete -F _recs recs
