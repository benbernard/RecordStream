#!/bin/sh
find . \( -type f -o -type l \) \
   -not -name 'Makefile.old' \
   -not -path './makedeb/*' \
   -not -path "./debian/*" \
   -not -path "./todo/*" \
   -not -path "./App-RecordStream*.tar.gz" \
   -not -path "./deb-dist/*" \
   -not -path "./blib/*" \
   -not -path './.git/*' \
   -not -path './tarball/*' \
   -not -path ./Makefile \
   -not -name MANIFEST \
   -not -name 'MYMETA*' \
   -not -name pm_to_blib \
   -not -name testDb \
   -not -name 'libapp-recordstream*.deb' \
   | sed -e 's/^\.\///' | sort >MANIFEST

