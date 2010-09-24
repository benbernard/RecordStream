
CFLAGS=-std=c99 -Wall -O6
OBJS=recs-collate.o lookup3.o hash.o aggregators.o
GAZELLE_DIR=/Users/joshua/code/gazelle
.PHONY: all clean

all: recs-collate

clean:
	rm -f $(OBJS) recs-collate

$(GAZELLE_DIR)/runtime/libparse.a:
	make -C $(GAZELLE_DIR)

recs-collate: $(OBJS) $(GAZELLE_DIR)/runtime/libparse.a
	gcc -o recs-collate $(OBJS) $(GAZELLE_DIR)/runtime/libparse.a -lm

$(OBJS): %.o: %.c
	gcc $(CFLAGS) -o $@ -c $< -I$(GAZELLE_DIR)/runtime
