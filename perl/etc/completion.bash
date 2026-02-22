#!/bin/bash
function __recscomp(){
  local recs cur prev
  recs=$1
  cur=$2
  prev=$3

  # Only complete the first word for now, i.e. the recs operation
  if [[ $COMP_CWORD -eq 1 ]]; then
    # We use the about-to-be-invoked cmd so we're using the same executable
    COMPREPLY=( "${COMPREPLY[@]}" $( compgen -W "$($recs --list)" -- "$cur" ) )
  fi
}
complete -r recs
complete -F __recscomp recs
