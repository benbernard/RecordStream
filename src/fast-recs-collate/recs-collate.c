
#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <errno.h>
#define __USE_XOPEN_EXTENDED
#include <string.h>
#include "interpreter.h"
#include "lookup3.h"
#include "hash.h"
#include "aggregators.h"
#include "json.h"

#define MAX_INFIELDS_PER_AGGREGATOR 2
#define MAX_CLUMPS_INFINITE -1

struct clump
{
    hnode_t hash_node;
    char **key_values;
    struct clump *next, *prev;  /* for doing LRU eviction */
    double aggregator_data[];   /* use doubles to get double alignment */
};


struct str_ref
{
    int offset;
    int len;
    bool is_set;
};

struct agg_instance
{
    struct aggregator *agg;
    char *output_field_name;
    int num_input_fields;
    int input_fields[MAX_INFIELDS_PER_AGGREGATOR];
    void *config_data;
};

struct collate_state
{
    int max_clumps;
    bool incremental;

    int num_agg_instances;
    struct agg_instance *agg_instances;

    int cube_max;
    char *cube_default;

    hash_t *clump_table;

    int num_interesting_fields;
    int num_key_fields;
    char **interesting_field_names;

    int interesting_field;
    struct str_ref *interesting_fields;
    char **tmp_interesting_vals;
    double *tmp_double_vals;

    int next_clump;
    int total_available_clumps;
    int clump_size;
    char *available_clumps;
    struct clump *clumps_head, *clumps_tail;
};

void dump_clump(struct clump *clump, struct collate_state *cs)
{
    fputc('{', stdout);
    int i = 0;
    for(i = 0; i < cs->num_key_fields; i++)
    {
        if(i != 0) putc(',', stdout);

        char *val = clump->key_values[i];
        if(val)
            printf("\"%s\":\"%s\"", cs->interesting_field_names[i], val);
        else
            printf("\"%s\":null", cs->interesting_field_names[i]);
    }

    char *agg_data = (char*)&clump->aggregator_data[0];
    for(int j = 0; j < cs->num_agg_instances; j++)
    {
        struct agg_instance *agg_inst = &cs->agg_instances[j];
        if(i != 0) putc(',', stdout);
        printf("\"%s\":", agg_inst->output_field_name);
        agg_inst->agg->dump_func(agg_inst->config_data, agg_data);
        agg_data += agg_inst->agg->data_size;
    }

    fputs("}\n", stdout);
}

/* use this itty bitty piece of global data so our hash functions know how many
 * strings to expect. */
int num_key_fields;

int hash_comp_func(const void *_k1, const void *_k2)
{
    char **k1 = (char**)_k1;
    char **k2 = (char**)_k2;
    for(int i = 0; i < num_key_fields; i++)
    {
        if(k1[i] == NULL || k2[i] == NULL)
        {
            if(k1[i] == k2[i])
                return 0;
            else if(k1[i] == NULL)
                return -1;
            else
                return 1;
        }
        else
        {
            int cmp = strcmp(k1[i], k2[i]);
            if(cmp != 0)
                return cmp;
        }
    }
    return 0;
}

hash_val_t hash_func(const void *_k)
{
    char **k = (char**)_k;
    int hash = 0;
    for(int i = 0; i < num_key_fields; i++)
        if(k[i])
            hash = hashlittle(k[i], strlen(k[i]), hash);

    return hash;
}

/*
 * This callback will be called every time the parser parses a string.
 * In this callback, however, we are only concerned with strings that
 * are keys of the top-level object, so we immediately bail unless the
 * parse stack is two deep.
 *
 * When we are parsing a key to the top-level object, we see if the
 * string matches any of the keys we care about (because they are key
 * fields or we are aggregating on them).  If so, we save that information
 * in our collate_state.
 */
void string_callback(struct parse_state *parse_state, void *_state)
{
    struct collate_state *state = _state;
    struct parse_stack_frame *frame;
    if(parse_state->parse_stack_length == 2) // object, string
    {
        frame = &parse_state->parse_stack[parse_state->parse_stack_length-1];

        /* grab offsets for the string and adjust them to ditch the quotes */
        int start_off        =  frame->start_offset - parse_state->buffer->base_offset;
        int one_past_end_off =  parse_state->offset - parse_state->buffer->base_offset;
        start_off++;
        one_past_end_off--;

        /* NULL-terminate the parsed string by writing a null into the buffer */
        parse_state->buffer->buf[one_past_end_off] = '\0';

        /* str is now our parsed string */
        char *str = (char*)parse_state->buffer->buf + start_off;

        /* Is this an interesting field?  If so, save the offset into the
         * table of interesting strings */
        int i;
        for(i = 0; state->interesting_field_names[i] != NULL; i++)
        {
            if(strcmp(str, state->interesting_field_names[i]) == 0)
            {
                state->interesting_field = i;
                break;
            }
        }

        /* if this wasn't an interesting string, use -1 to note that */
        if(state->interesting_field_names[i] == NULL)
            state->interesting_field = -1;
    }
}

/*
 * This callback will be called every time a value of any kind is parsed.
 * We only want to pay attention to string or integer values in the top-level
 * object, so we bail if the stack is the wrong depth (we're parsing a value
 * in a sub-hash) or it's the wrong type (object, array, true, false, or null)
 *
 * If this is a top-level scalar value and we've just seen a key for a field
 * we care about, we insert pointers to this value into a table of interesting values
 * for processing once we hit the end of the record.
 */
void value_callback(struct parse_state *parse_state, void *_state)
{
    struct collate_state *state = _state;
    struct parse_stack_frame *frame;
    if(parse_state->parse_stack_length == 2 && state->interesting_field != -1) // object, value
    {
        frame = &parse_state->parse_stack[parse_state->parse_stack_length-1];
        int start_off =  frame->start_offset;
        int one_past_end_off =  parse_state->offset;

        /* if this is an object, array, true, false, or null, then bail */
        int ch = parse_state->buffer->buf[start_off - parse_state->buffer->base_offset];
        if(ch == '{' || ch == '[' || ch == 't' || ch == 'f' || ch == 'n')
            return;

        /* if this is a string, ditch the quotation marks */
        if(ch == '"')
        {
            start_off++;
            one_past_end_off--;
        }

        /* NULL-terminate the value (for later) */
        char save = parse_state->buffer->buf[one_past_end_off - parse_state->buffer->base_offset];
        parse_state->buffer->buf[one_past_end_off - parse_state->buffer->base_offset] = '\0';

        /* save this value in our table of interesting values */
        struct str_ref *field = &state->interesting_fields[state->interesting_field];
        field->offset = start_off;
        field->len = one_past_end_off - start_off;
        field->is_set = true;

        parse_state->buffer->buf[one_past_end_off - parse_state->buffer->base_offset] = save;
    }
}

struct clump *find_or_create_clump(struct collate_state *state, char *key_vals[])
{
    /* do the hash lookup based on key_vals */
    struct clump *clump = (struct clump*)hash_lookup(state->clump_table, key_vals);

    if(clump)
    {
        /* remove this clump from wherever it is in the LRU list */
        if(clump->next) clump->next->prev = clump->prev;
        else state->clumps_tail = clump->prev;

        if(clump->prev) clump->prev->next = clump->next;
        else state->clumps_head = clump->next;
    }
    else
    {
        /* this clump doesn't exist in the table -- we'll have to create it */

        /* first find the memory.  if we're on a fixed number of clumps and
         * we've hit that limit, evict.  otherwise, allocate. */
        if(state->max_clumps != MAX_CLUMPS_INFINITE &&
           hash_count(state->clump_table) >= state->max_clumps)
        {
            /* do an LRU eviction */
            clump = state->clumps_tail;

            state->clumps_tail = state->clumps_tail->prev;
            if(state->clumps_tail) state->clumps_tail->next = NULL;
            else state->clumps_head = NULL;

            if(!state->incremental)
                dump_clump(clump, state);

            hash_delete(state->clump_table, &clump->hash_node);

            for(int i = 0; i < state->num_key_fields; i++)
                free(clump->key_values[i]);
            free(clump->key_values[state->num_key_fields]);
        }
        else
        {
            /* allocate a clump */
            clump = malloc(state->clump_size);
        }

        /* now create a copy of the key (set of key fields) that will belong to the table */
        clump->key_values = malloc(sizeof(char*) * (state->num_key_fields+1));
        for(int i = 0; i < state->num_key_fields; i++)
        {
            if(key_vals[i])
                clump->key_values[i] = strdup(key_vals[i]);
            else
                clump->key_values[i] = NULL;
        }
        clump->key_values[state->num_key_fields] = NULL;

        /* now give all the aggregator instances a chance to init their data in the clump */
        char *agg_data = (char*)&clump->aggregator_data[0];
        for(int i = 0; i < state->num_agg_instances; i++)
        {
            struct agg_instance *agg_inst = &state->agg_instances[i];
            agg_inst->agg->init_func(agg_inst->config_data, agg_data);
            agg_data += agg_inst->agg->data_size;
        }

        /* insert this clump into the hash table */
        hnode_init(&clump->hash_node, 0);
        hash_insert(state->clump_table, &clump->hash_node, clump->key_values);
    }

    /* move this clump to the front of the LRU list */
    clump->next = state->clumps_head;
    clump->prev = NULL;

    if(state->clumps_head) state->clumps_head->prev = clump;
    else state->clumps_tail = clump;
    state->clumps_head = clump;

    return clump;
}

void find_and_add_to_clump(struct collate_state *state, char *vals[], double d_vals[])
{
    struct clump *clump = find_or_create_clump(state, vals);

    char *agg_data = (char*)&clump->aggregator_data[0];
    for(int i = 0; i < state->num_agg_instances; i++)
    {
        char *agg_vals[MAX_INFIELDS_PER_AGGREGATOR];
        double agg_d_vals[MAX_INFIELDS_PER_AGGREGATOR];
        struct agg_instance *agg_inst = &state->agg_instances[i];

        /* map the values to the ones that the aggregator cares about */

        for(int j = 0; j < agg_inst->num_input_fields; j++)
        {
            agg_vals[j] = vals[agg_inst->input_fields[j]];
            agg_d_vals[j] = d_vals[agg_inst->input_fields[j]];
        }

        /* run the aggregator's add callback! */

        agg_inst->agg->add_func(agg_inst->config_data, agg_data, agg_vals, agg_d_vals);
        agg_data += agg_inst->agg->data_size;
    }

    if(state->incremental)
        dump_clump(clump, state);
}


/*
 * This callback is called at the end of each object.  If the object that's ending
 * is the top-level object, this is where we do the work of finding or creating
 * the bucket for this record and letting each aggregator instance aggregate.
 */
void object_callback(struct parse_state *parse_state, void *_state)
{
    struct collate_state *state = _state;
    if(parse_state->parse_stack_length == 1) // object
    {
        /* NULL-terminate all values */
        char *buf = (char*)parse_state->buffer->buf - parse_state->buffer->base_offset;
        for(int i = 0; i < state->num_interesting_fields; i++)
        {
            struct str_ref *field = &state->interesting_fields[i];
            if(field->is_set)
                buf[field->offset+field->len] = '\0';
        }

        /* first pack the interesting values into a table of char** */

        char *vals[state->num_interesting_fields+1];

        for(int i = 0; i < state->num_interesting_fields; i++)
        {
            struct str_ref *field = &state->interesting_fields[i];
            if(field->is_set)
                vals[i] = buf + field->offset;
            else
                vals[i] = NULL;
        }
        vals[state->num_interesting_fields] = NULL;

        /* now try to convert each value into a double, for aggregators that want that.
         * values that have no numeric data are represented as NAN */

        double dbl_vals[state->num_interesting_fields];

        for(int i = 0; i < state->num_interesting_fields; i++)
        {
            if(vals[i])
            {
                char *endp;
                dbl_vals[i] = strtod(vals[i], &endp);
                if(vals[i] == endp)
                    dbl_vals[i] = NAN;
            }
            else
                dbl_vals[i] = NAN;
        }

        /* to support cubing, we use the binary representation of the numbers 0 -- cube_max
         * as a power set.  if a bit is 0, then the real value is used.  if a bit is 1,
         * the cube default is used.  if we're not cubing, cube_max is 1 and we only use
         * 0: the value for which all real values are used. */
        for(int i = 0; i < state->cube_max; i++)
        {
            char *clump_vals[state->num_interesting_fields];
            double dbl_clump_vals[state->num_interesting_fields];

            for(int j = 0; j < state->num_interesting_fields; j++)
            {
                if((1 << j) & i)
                {
                    clump_vals[j] = state->cube_default;
                    dbl_clump_vals[j] = NAN;
                }
                else
                {
                    clump_vals[j] = vals[j];
                    dbl_clump_vals[j] = dbl_vals[j];
                }
            }

            find_and_add_to_clump(state, clump_vals, dbl_clump_vals);
        }
    }
}

void init_parser(struct parse_state *state, struct grammar **g, FILE *input)
{
    struct bc_read_stream *s = bc_rs_open_mem(json_bc);
    *g = load_grammar(s);

    bc_rs_close_stream(s);

    alloc_parse_state(state);
    init_parse_state(state, *g, input);
}

char usage[] =
"Usage: recs-collate <args> [<files>]\n"
"   Collate records of input (or records from <files>) into output records.\n"
"\n"
"Arguments:\n"
"   --key|-k <keys>               Comma separated list of key fields.\n"
"   --aggregator|-a <aggregators> Colon separated list of aggregate field specifiers.\n"
"                                 See \"Aggregates\" section below.\n"
"   --size|--sz|-n <number>       Number of running clumps to keep (default is 1).\n"
"   --adjacent|-a|-1              Keep exactly one running clump.\n"
"   --perfect                     Never purge clumps until the end.\n"
"   --cube                        See \"Cubing\" section below.\n"
"   --cube-default                See \"Cubing\" section below.\n"
"   --incremental                 Output a record every time an input record is added\n"
"                                 to a clump (instead of everytime a clump is flushed).\n"
"\n"
"Help / Usage Options:\n"
"   --help                         Bail and output this help screen.\n"
"   --list-aggregators             Bail and output a list of aggregators.\n"
"   --show-aggregator <aggregator> Bail and output this aggregator's detailed usage.\n"
"\n"
"Aggregates:\n"
"   Aggregates are specified as [<fieldname>=]<aggregator>[,<arguments>].  The\n"
"   default field name is aggregator and arguments joined by underscores.  See\n"
"   --list-aggregators for a list of available aggregators.\n"
"\n"
"Cubing:\n"
"   Instead of added one entry for each input record, we add 2 ** (number of key\n"
"   fields), with every possible combination of fields replaced with the default\n"
"   (which defaults to \"ALL\" but can be specified with --cube-default).  This is\n"
"   really supposed to be used with --perfect.  If our key fields were x and y\n"
"   then we'd get output records for {x = 1, y = 2}, {x = 1, y = ALL}, {x = ALL,\n"
"   y = 2} and {x = ALL, y = ALL}.\n"
"\n"
"Examples:\n"
"   Count clumps of adjacent lines with matching x fields.\n"
"      recs-collate --adjacent --key x --aggregator count\n"
"   Count number of each x field in the entire file.\n"
"      recs-collate --perfect --key x --aggregator count\n"
"   Count number of each x field in the entire file, including an \"ALL\" line.\n"
"      recs-collate --perfect --key x --aggregator count --cube\n"
"   Produce a cummulative sum of field profit up to each date\n"
"      recs-collate --key date --incremental --aggregator profit_to_date=sum,profit\n"
"   Produce record count for each date, hour pair\n"
"      recs-collate --key date,hour --perfect --aggregator count\n";

void usage_err(char *fmt, ...)
{
    va_list args;
    fprintf(stderr, "recs-collate: ");

    va_start(args, fmt);
    vfprintf(stderr, fmt, args);
    va_end(args);

    fprintf(stderr, "\n");
    fprintf(stderr, usage);
    exit(1);
}

struct interesting_field
{
    char *name;
    bool is_key;
} *fields;

int fields_len = 0, fields_size = 6;

int add_interesting_field(char *str, bool is_key)
{
    for(int i = 0; i < fields_len; i++)
    {
        if(strcmp(str, fields[i].name) == 0)
        {
            if(is_key) fields[i].is_key = true;
            return i;
        }
    }
    RESIZE_ARRAY_IF_NECESSARY(fields, fields_size, fields_len+1);
    struct interesting_field *new_field = &fields[fields_len++];
    new_field->name = strdup(str);
    new_field->is_key = is_key;
    return fields_len-1;
}

void init_agg_instance(struct agg_instance *agg_inst, char *agg_str)
{
    /* agg_str is in format: [<fieldname>=]<aggregator>[,<arguments>] */

    char *ch;
    if((ch = strchr(agg_str, '=')))
    {
        /* a fieldname was supplied */
        *ch = '\0';
        agg_inst->output_field_name = strdup(agg_str);
        *ch = '=';
        agg_str = ch+1;
    }
    else
    {
        /* no fieldname was supplied -- create the default one */
        agg_inst->output_field_name = strdup(agg_str);
        char *comma = agg_inst->output_field_name;
        while((comma = strchr(comma, ',')))
        {
            *comma = '_';
        }
    }

    if((ch = strchr(agg_str, ','))) *ch = '\0';

    /* find the aggregator matching this name */
    struct aggregator *aggregator = &aggregators[0];
    for(; aggregator->name; aggregator++)
    {
        if(strcmp(agg_str, aggregator->name) == 0 ||
           strcmp(agg_str, aggregator->shortname) == 0)
        {
            int num_fields = 0;
            char *fields[MAX_INFIELDS_PER_AGGREGATOR];
            agg_inst->agg = aggregator;
            agg_inst->agg->parse_args_func(&agg_inst->config_data, ch+1, &num_fields, fields);
            agg_inst->num_input_fields = num_fields;

            /* are we already watching the fields the aggregator wants?
             * if not, start watching them. */
            for(int k = 0; k < num_fields; k++)
                agg_inst->input_fields[k] = add_interesting_field(fields[k], false);

            return;
        }
    }

    usage_err("Couldn't find an aggregator named '%s'", agg_str);
}


int main(int argc, char *argv[])
{
    struct parse_state state;
    int agg_instances_size = 6;
    int agg_instances_data_size = 0;
    bool cube = false;
    struct collate_state cs = {
         .max_clumps = 1,
         .incremental = false,
         .num_agg_instances = 0,
         .agg_instances = malloc(sizeof(*cs.agg_instances) * agg_instances_size),
         .clump_table = hash_create(HASHCOUNT_T_MAX, hash_comp_func, hash_func),
         .clumps_head = NULL,
         .clumps_tail = NULL,
         .cube_max = 1,
         .cube_default = "ALL"
    };

    int files_len = 0, files_size = 5;
    FILE **files = malloc(sizeof(*files) * files_size);

    /* round up the size of each aggregator data to a multiple of sizeof(double) */
    for(struct aggregator *agg = aggregators; agg->name; agg++)
        agg->data_size = ceil((double)agg->data_size / sizeof(double)) * sizeof(double);

    struct grammar *g = NULL;

    fields = malloc(sizeof(*fields) * fields_size);

    /* parse command-line options */
    for(int i = 1; i < argc; i++)
    {
        char *arg = argv[i];

        if(strcmp(arg, "--key") == 0 || strcmp(arg, "-k") == 0)
        {
            char *keys = argv[++i];
            if(keys == NULL)
                usage_err("argument '%s' must be followed by a list of keys", arg);

            char *str = strtok(keys, ",");
            do {
                add_interesting_field(str, true);
            } while((str = strtok(NULL, ",")));
        }
        else if(strcmp(arg, "--aggregator") == 0 || strcmp(arg, "-a") == 0)
        {
            char *aggs = argv[++i];
            if(aggs == NULL)
                usage_err("argument '%s' must be followed by a list of aggregators", arg);

            char *agg = strtok(aggs, ":");
            do {
                RESIZE_ARRAY_IF_NECESSARY(cs.agg_instances, agg_instances_size,
                                          cs.num_agg_instances+1);
                struct agg_instance *agg_inst = &cs.agg_instances[cs.num_agg_instances++];
                init_agg_instance(agg_inst, agg);
                agg_instances_data_size += agg_inst->agg->data_size;
            } while((agg = strtok(NULL, ":")));
        }
        else if(strcmp(arg, "--size") == 0 || strcmp(arg, "--sz") == 0 ||
                strcmp(arg, "-n") == 0)
        {
            char *size_str = argv[++i];
            if(size_str == NULL)
                usage_err("argument '%s' must be followed by an integer", arg);

            long int size = strtol(size_str, NULL, 10);

            if(errno == EINVAL)
                usage_err("parameter to '%s' argument was not a valid integer", arg);
            if(size < 1)
                usage_err("the size must be greater than 0");

            cs.max_clumps = size;
        }
        else if(strcmp(arg, "--adjacent") == 0 || strcmp(arg, "-a") == 0 ||
                strcmp(arg, "-1") == 0)
        {
            cs.max_clumps = 1;
        }
        else if(strcmp(arg, "--perfect") == 0)
        {
            cs.max_clumps = MAX_CLUMPS_INFINITE;
        }
        else if(strcmp(arg, "--incremental") == 0)
        {
            cs.incremental = true;
        }
        else if(strcmp(arg, "--cube") == 0)
        {
            cube = true;
        }
        else if(strcmp(arg, "--cube-default") == 0)
        {
            char *cube_default = argv[++i];
            if(cube_default == NULL)
                usage_err("argument '--cube-default' must be followed by a string");
            cs.cube_default = strdup(cube_default);
        }
        else
        {
            /* interpret the argument as a filename */
            FILE *f = fopen(arg, "r");
            if(f)
            {
                RESIZE_ARRAY_IF_NECESSARY(files, files_size, files_len+1);
                files[files_len++] = f;
            }
            else
            {
                usage_err("Couldn't open file '%s' for reading", arg);
            }
        }
    }

    if(files_len == 0)
        files[files_len++] = stdin;

    if(fields_len == 0)
        usage_err("must specify --key or --aggregator");

    cs.num_interesting_fields = fields_len;
    cs.num_key_fields = 0;

    cs.interesting_field_names = malloc(sizeof(*cs.interesting_field_names) *
                                        (cs.num_interesting_fields+1));
    for(int i = 0; i < fields_len; i++)
        if(fields[i].is_key)
            cs.interesting_field_names[cs.num_key_fields++] = fields[i].name;

    int nonkey_field_num = 0;
    for(int i = 0; i < fields_len; i++)
        if(!fields[i].is_key)
            cs.interesting_field_names[cs.num_key_fields + nonkey_field_num++] = fields[i].name;

    num_key_fields = cs.num_key_fields;

    if(cube)
    {
        cs.cube_max = 1 << cs.num_key_fields;
        if(cs.max_clumps != MAX_CLUMPS_INFINITE && cs.max_clumps < cs.cube_max)
            usage_err("when cubing, you must have at least 2 ** num_key_fields clumps");
    }


    /* adjust agg instance field names to reflect new field order */
    for(int i = 0; i < cs.num_agg_instances; i++)
    {
        struct agg_instance *agg_inst = &cs.agg_instances[i];
        for(int j = 0; j < agg_inst->num_input_fields; j++)
        {
            for(int k = 0; k < cs.num_interesting_fields; k++)
            {
                if(strcmp(cs.interesting_field_names[k],
                          fields[agg_inst->input_fields[j]].name) == 0)
                {
                    agg_inst->input_fields[j] = k;
                    break;
                }
            }
        }
    }

    cs.interesting_field_names[cs.num_interesting_fields] = NULL;

    cs.interesting_field = -1;
    cs.interesting_fields = malloc(sizeof(*cs.interesting_fields) * cs.num_interesting_fields);
    cs.tmp_interesting_vals = malloc(sizeof(*cs.tmp_interesting_vals) * (cs.num_interesting_fields+1));
    cs.tmp_interesting_vals[cs.num_key_fields] = NULL;
    cs.tmp_double_vals = malloc(sizeof(*cs.tmp_double_vals) * cs.num_interesting_fields);

    cs.clump_size = sizeof(struct clump) + agg_instances_data_size;
    cs.total_available_clumps = 128;
    cs.available_clumps = malloc(cs.clump_size * cs.total_available_clumps);
    cs.next_clump = 0;

    for(int i = 0; i < files_len; i++)
    {
        init_parser(&state, &g, files[i]);

        register_callback(&state, "string", string_callback, &cs);
        register_callback(&state, "value", value_callback, &cs);
        register_callback(&state, "object", object_callback, &cs);

        bool eof = false;

        while(!eof)
        {
            for(int field = 0; field < cs.num_interesting_fields; field++)
                cs.interesting_fields[field].is_set = false;

            parse(&state, &eof);
            reinit_parse_state(&state);
        }

        free_parse_state(&state);
    }

    hscan_t scan;
    hash_scan_begin(&scan, cs.clump_table);
    hnode_t *node;
    while((node = hash_scan_next(&scan)))
    {
        if(!cs.incremental)
            dump_clump((struct clump*)node, &cs);
        hash_scan_delete(cs.clump_table, node);
    }

    free_grammar(g);
}

