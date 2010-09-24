
#include "aggregators.h"
#include "hash.h"
#include "lookup3.h"

#define __USE_XOPEN_EXTENDED
#include <string.h>
#include <math.h>
#include <stdio.h>
#include <stdint.h>

static bool use_one_field(char *config_str, int *num_fields, char *fields[])
{
    if(*config_str)
    {
        fields[0] = config_str;
        *num_fields = 1;
        return true;
    }
    else
    {
        return false;
    }
}

static bool use_two_fields(char *config_str, int *num_fields, char *fields[])
{
    if(*config_str)
    {
        char *comma = strchr(config_str, ',');
        if(!comma) return false;
        *comma++ = '\0';
        *num_fields = 2;
        fields[0] = config_str;
        fields[1] = comma;
        return true;
    }
    else
    {
        return false;
    }
}

/*
 * Average
 */

struct avg_data
{
    double total;
    double count;
};

static bool avg_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return use_one_field(config_str, num_fields, fields);
}

static void avg_init(void *config_data, void *_d)
{
    struct avg_data *d = _d;
    d->total = 0;
    d->count = 0;
}

static void avg_add(void *config_data, void *_d, char *ch_data[], double num_data[])
{
    struct avg_data *d = _d;
    if(!isnan(num_data[0]))
    {
        d->total += num_data[0];
        d->count += 1;
    }
}

static void avg_dump(void *config_data, void *_d)
{
    struct avg_data *d = _d;
    printf("%g", d->total / d->count);
}

/*
 * Concatenate
 */

struct concat_data
{
    int buf_len;
    int buf_size;
    char *concat_buf;
};

struct concat_config_data
{
    char *delim;
    int delim_len;
};

static bool concat_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    if(*config_str)
    {
        char *comma = strchr(config_str, ',');
        if(!comma) return false;
        *comma++ = '\0';

        struct concat_config_data *c = *config_data = malloc(sizeof(struct concat_config_data));
        c->delim = strdup(config_str);
        c->delim_len = strlen(c->delim);

        fields[0] = comma;
        *num_fields = 1;

        return true;
    }
    else
    {
        return false;
    }
}

static void concat_init(void *_c, void *_d)
{
    struct concat_data *d = _d;
    d->buf_len = 0;
    d->buf_size = 128;
    d->concat_buf = malloc(sizeof(char) * d->buf_size);
}

static void concat_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct concat_config_data *c = _c;
    struct concat_data *d = _d;
    int len = strlen(ch_data[0]);
    RESIZE_ARRAY_IF_NECESSARY(d->concat_buf, d->buf_size, d->buf_len + len + c->delim_len);

    if(d->buf_len > 0)
    {
        memcpy(d->concat_buf + d->buf_len, c->delim, c->delim_len);
        d->buf_len += c->delim_len;
    }

    memcpy(d->concat_buf + d->buf_len, ch_data[0], len);
    d->buf_len += len;
}

static void concat_dump(void *_c, void *_d)
{
    struct concat_data *d = _d;
    putc('"', stdout);
    fwrite(d->concat_buf, sizeof(char), d->buf_len, stdout);
    putc('"', stdout);
}

static void concat_free(void *_c, void *_d)
{
    struct concat_data *d = _d;
    free(d->concat_buf);
}

/*
 * Count
 */

struct count_data
{
    uint64_t count;
};

static bool count_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return true;
}

static void count_init(void *_c, void *_d)
{
    struct count_data *d = _d;
    d->count = 0;
}

static void count_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct count_data *d = _d;
    d->count++;
}

static void count_dump(void *_c, void *_d)
{
    struct count_data *d = _d;
    printf("%llu", d->count);
}

/*
 * Covariance
 */

struct cov_data
{
    double count;
    double sum_of_products;
    double sum_of_first;
    double sum_of_second;
};

static bool cov_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return use_two_fields(config_str, num_fields, fields);
}

static void cov_init(void *_c, void *_d)
{
    struct cov_data *d = _d;
    d->count = 0;
    d->sum_of_products = 0;
    d->sum_of_first = 0;
    d->sum_of_second = 0;
}

static void cov_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct cov_data *d = _d;
    if(!isnan(num_data[0]) && !isnan(num_data[1]))
    {
        d->count++;
        d->sum_of_products += num_data[0] * num_data[1];
        d->sum_of_first += num_data[0];
        d->sum_of_second += num_data[1];
    }
}

static double cov_val(struct cov_data *d)
{
    double cov = (d->sum_of_products / d->count) -
                 ((d->sum_of_first / d->count) * (d->sum_of_second / d->count));
    return cov;
}

static void cov_dump(void *_c, void *_d)
{
    struct cov_data *d = _d;
    printf("%f", cov_val(d));
}

/*
 * Max
 */

struct max_data
{
    double max;
};

static bool max_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return use_one_field(config_str, num_fields, fields);
}

static void max_init(void *_c, void *_d)
{
    struct max_data *d = _d;
    d->max = -INFINITY;
}

static void max_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct max_data *d = _d;
    if(!isnan(num_data[0]) && num_data[0] > d->max)
        d->max = num_data[0];
}

static void max_dump(void *_c, void *_d)
{
    struct max_data *d = _d;
    printf("%g", d->max);
}

/*
 * Min
 */

struct min_data
{
    double min;
};

static bool min_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return use_one_field(config_str, num_fields, fields);
}

static void min_init(void *_c, void *_d)
{
    struct min_data *d = _d;
    d->min = INFINITY;
}

static void min_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct min_data *d = _d;
    if(!isnan(num_data[0]) && num_data[0] < d->min)
        d->min = num_data[0];
}

static void min_dump(void *_c, void *_d)
{
    struct min_data *d = _d;
    printf("%g", d->min);
}

/*
 * Sum
 */

struct sum_data
{
    double sum;
};

static bool sum_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return use_one_field(config_str, num_fields, fields);
}

static void sum_init(void *_c, void *_d)
{
    struct sum_data *d = _d;
    d->sum = 0;
}

static void sum_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct sum_data *d = _d;
    if(!isnan(num_data[0]))
        d->sum += num_data[0];
}

static void sum_dump(void *_c, void *_d)
{
    struct sum_data *d = _d;
    printf("%g", d->sum);
}

/*
 * Perc
 */

struct perc_config_data
{
    double percentile;
};

struct perc_data
{
    int values_len;
    int values_size;
    double *values;
};

static bool perc_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    if(*config_str)
    {
        char *comma = strchr(config_str, ',');
        if(!comma) return false;
        *comma++ = '\0';

        struct perc_config_data *c = *config_data = malloc(sizeof(struct perc_config_data));
        char *endp;
        c->percentile = strtod(config_str, &endp);
        if(endp == config_str) return false;  /* failed to parse into number */

        fields[0] = comma;
        *num_fields = 1;

        return true;
    }
    else
    {
        return false;
    }
}

static void perc_init(void *_c, void *_d)
{
    struct perc_data *d = _d;
    d->values_len = 0;
    d->values_size = 64;
    d->values = malloc(sizeof(*d->values) * d->values_size);
}

static void perc_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct perc_data *d = _d;
    if(!isnan(num_data[0]))
    {
        RESIZE_ARRAY_IF_NECESSARY(d->values, d->values_size, d->values_len+1);
        d->values[d->values_len++] = num_data[0];
    }
}

static int cmp_dbl(const void *s1, const void *s2)
{
    double d1 = *(double*)s1;
    double d2 = *(double*)s2;
    if(d1 < d2) return -1;
    else if(d1 > d2) return 1;
    else return 0;
}

static void perc_dump(void *_c, void *_d)
{
    struct perc_config_data *c = _c;
    struct perc_data *d = _d;
    qsort(d->values, d->values_len, sizeof(*d->values), cmp_dbl);
    double perc = d->values[(int)floor((c->percentile / 100) * d->values_len)];
    printf("%g", perc);
}

static void perc_free(void *_c, void *_d)
{
    struct concat_data *d = _d;
    free(d->concat_buf);
}

/*
 * Mode
 */

static hash_val_t str_hash_func(const void *_k)
{
    char *k = (char*)_k;
    return hashlittle(k, strlen(k), 0);
}

struct table_entry
{
    double count;
};

struct mode_data
{
    hash_t *hash_table;

    /* this is just a pool of nodes */
    int nodes_len, nodes_size;
    hnode_t *nodes;

    /* this is just a pool of table_entry objs */
    int entries_len, entries_size;
    struct table_entry *entries;
};

static bool mode_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return use_one_field(config_str, num_fields, fields);
}

static void mode_init(void *_c, void *_d)
{
    struct mode_data *d = _d;
    d->hash_table = hash_create(HASHCOUNT_T_MAX, NULL, str_hash_func);
    d->nodes_size = d->entries_size = 32;
    d->nodes_len = d->entries_len = 0;
    d->nodes = malloc(sizeof(*d->nodes) * d->nodes_size);
    d->entries = malloc(sizeof(*d->entries) * d->entries_size);
}

static void mode_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct mode_data *d = _d;
    hnode_t *node = hash_lookup(d->hash_table, ch_data[0]);
    if(node == NULL)
    {
        RESIZE_ARRAY_IF_NECESSARY(d->nodes, d->nodes_size, d->nodes_len+1);
        RESIZE_ARRAY_IF_NECESSARY(d->entries, d->entries_size, d->entries_len+1);
        struct table_entry *entry = &d->entries[d->entries_len++];
        entry->count = 0;
        node = hnode_init(&d->nodes[d->nodes_len++], entry);
        hash_insert(d->hash_table, node, strdup(ch_data[0]));
    }
    struct table_entry *entry = hnode_get(node);
    entry->count++;
}

static void mode_dump(void *_c, void *_d)
{
    printf("Mode dump!\n");
    struct mode_data *d = _d;
    hscan_t scan;
    hash_scan_begin(&scan, d->hash_table);
    hnode_t *node;
    double max_num = 0;
    char *max_val = NULL;
    while((node = hash_scan_next(&scan)))
    {
        struct table_entry *entry = hnode_get(node);
        if(entry->count > max_num)
        {
            max_num = entry->count;
            max_val = (char*)hnode_getkey(node);
        }
    }
    putc('"', stdout);
    fputs(max_val, stdout);
    putc('"', stdout);
}

static void mode_free(void *_c, void *_d)
{
    struct mode_data *d = _d;

    /* free all the hash keys */
    hscan_t scan;
    hash_scan_begin(&scan, d->hash_table);
    hnode_t *node;
    while((node = hash_scan_next(&scan)))
    {
        hash_scan_delete(d->hash_table, node);
        free((void*)hnode_getkey(node));
    }

    hash_destroy(d->hash_table);

    /* free the pools of nodes and entries */
    free(d->nodes);
    free(d->entries);
}


/*
 * Variance
 */

struct var_data
{
    double count;
    double sum_of_squares;
    double sum;
};

static bool var_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return use_one_field(config_str, num_fields, fields);
}

static void var_init(void *_c, void *_d)
{
    struct var_data *d = _d;
    d->count = 0;
    d->sum_of_squares = 0;
    d->sum = 0;
}

static void var_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct var_data *d = _d;
    if(!isnan(num_data[0]))
    {
        d->count++;
        d->sum_of_squares += num_data[0] * num_data[0];
        d->sum += num_data[0];
    }
}

static double var_val(struct var_data *d)
{
    double avg = d->sum / d->count;
    double var = (d->sum_of_squares / d->count) - (avg * avg);
    return var;
}

static void var_dump(void *_c, void *_d)
{
    struct var_data *d = _d;
    printf("%g", var_val(d));
}

/*
 * Correlation
 */

struct corr_data
{
    struct cov_data cov_data;
    struct var_data var_data1;
    struct var_data var_data2;
};

static bool corr_parse_args(void **config_data, char *config_str, int *num_fields, char **fields)
{
    return use_two_fields(config_str, num_fields, fields);
}

static void corr_init(void *_c, void *_d)
{
    struct corr_data *d = _d;
    cov_init(_c, &d->cov_data);
    var_init(_c, &d->var_data1);
    var_init(_c, &d->var_data2);
}

static void corr_add(void *_c, void *_d, char *ch_data[], double num_data[])
{
    struct corr_data *d = _d;
    cov_add(NULL, &d->cov_data, ch_data, num_data);
    var_add(NULL, &d->var_data1, ch_data, num_data);
    var_add(NULL, &d->var_data2, ch_data+1, num_data+1);
}

static void corr_dump(void *_c, void *_d)
{
    struct corr_data *d = _d;
    double cov = cov_val(&d->cov_data);
    double var1 = var_val(&d->var_data1);
    double var2 = var_val(&d->var_data2);
    double corr = cov / sqrt(var1 * var2);
    printf("%g", corr);
}

struct aggregator aggregators[] = {
    {"average", "avg", sizeof(struct avg_data),
      avg_parse_args, avg_init, avg_add, avg_dump, NULL},
    {"concatenate", "concat", sizeof(struct concat_data),
      concat_parse_args, concat_init, concat_add, concat_dump, concat_free},
    {"count", "ct", sizeof(struct count_data),
      count_parse_args, count_init, count_add, count_dump, NULL},
    {"correlation", "corr", sizeof(struct corr_data),
      corr_parse_args, corr_init, corr_add, corr_dump, NULL},
    {"covariance", "cov", sizeof(struct cov_data),
      cov_parse_args, cov_init, cov_add, cov_dump, NULL},
    {"maximum", "max", sizeof(struct max_data),
      max_parse_args, max_init, max_add, max_dump, NULL},
    {"minimum", "min", sizeof(struct min_data),
      min_parse_args, min_init, min_add, min_dump, NULL},
    {"mode", "mode", sizeof(struct mode_data),
      mode_parse_args, mode_init, mode_add, mode_dump, mode_free},
    {"percentile", "perc", sizeof(struct perc_data),
      perc_parse_args, perc_init, perc_add, perc_dump, perc_free},
    {"sum", "sum", sizeof(struct sum_data),
      sum_parse_args, sum_init, sum_add, sum_dump, NULL},
    {"variance", "var", sizeof(struct var_data),
      var_parse_args, var_init, var_add, var_dump, NULL},
    {NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL}
};

