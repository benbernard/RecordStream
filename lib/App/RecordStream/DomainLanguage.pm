package App::RecordStream::DomainLanguage;

use strict;
use warnings;

sub usage {
   return "DOMAIN LANGUAGE\n" . short_usage() . long_usage();
}

sub short_usage {
   return <<HELP;
   The normal mechanism for specifying e.g.  keys and aggregators allows one to
   concisely instantiate the objects that back them in the platform and is
   certainly the easiest way to use recs.  The record stream domain language
   allows the creation of these objects in a programmatic way, with neither the
   syntactic issues of the normal way nor the its guiding hand.

   The domain language is itself just PERL with a collection of library
   functions for creating platform objects included.  Your favorite aggregators
   are all here with constructors matching their normal token.  For convenience
   of e.g.  last, aggregators are also included with a prefixed underscore.

   Below you can find documentation on all the "built in" functions.  Most
   aggregators should be present with arguments comparable to their normal
   instantiation arugments, but with keyspec parameters replaced with
   valuations parameters.
HELP
}

sub long_usage {
   return <<HELP;

   for_field(qr/.../, '...')
      Takes a regex and a snippet of code.  Creates an aggregator that creates
      a map.  Keys in the map corresponde to fields chosen by matching the
      regex against the fields from input records.  Values in the map are
      produced by aggregators which the snippet must act as a factory for (\$f
      is the field).

      Example(s):
         To aggregate the sums of all the fields beginning with "t"
            for_field(qr/^t/, 'sum(\$f)')

   rec()
   record()
      A valuation that just returns the entire record.

   type_agg(obj)
   type_scalar(obj)
   type_val(obj)
      Force the object into a specific type.  Can be used to force certain
      upconversions (or avoid them).

   valuation(sub { ... })
   val(sub { ... })
      Takes a subref, creates a valuation that represents it.  The subref will
      get the record as its first and only argument.

      Example(s):
         To get the square of the "x" field:
            val(sub{ \$[0]->{x} ** 2 })
HELP
}

1;
