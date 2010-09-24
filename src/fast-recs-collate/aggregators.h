
#include <stdlib.h>
#include <stdbool.h>

struct aggregator
{
    char *name;
    char *shortname;
    size_t data_size;
    bool (*parse_args_func)(void **config_data, char*, int*, char**);
    void (*init_func)(void *config_data, void*clump_data);
    void (*add_func)(void *config_data, void *clump_data, char *ch_data[], double num_data[]);
    void (*dump_func)(void *config_data, void *clump_data);
    void (*free_func)(void *config_data, void *clump_data);
};

extern struct aggregator aggregators[];

#define RESIZE_ARRAY_IF_NECESSARY(ptr, size, desired_size) \
    if(size < desired_size) \
    { \
        while(size < desired_size) size *= 2; \
        ptr = realloc(ptr, size*sizeof(*ptr)); \
    }

