#!/bin/sh
find . \( -type f -o -type l \) -not -name 'Makefile.old' -not -path './makedeb/*' -not -path "./debian/*" -not -path "./blib/*" -not -path ./Makefile -not -name MANIFEST -not -path './.git/*' | sed -e 's/^\.\///' | sort >MANIFEST

