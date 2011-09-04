#!/bin/sh
find . -type f -not -path ./Makefile -not -name MANIFEST -not -path './.git/*' | sed -e 's/^\.\///' >MANIFEST

