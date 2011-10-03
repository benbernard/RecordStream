package App::RecordStream::DomainLanguage;

use strict;
use warnings;

sub usage {
   return "DOMAIN LANGUAGE\n" . short_usage() . _long_usage();
}

sub short_usage {
   return <<HELP;
   __FORMAT_TEXT__
   The normal mechanism for specifying keys and aggregators allows one to
   concisely instantiate the objects that back them in the platform and is
   certainly the easiest way to use recs.  The record stream domain language
   allows the creation of these objects in a programmatic way, with neither the
   syntactic issues of the normal way nor its guiding hand.

   The domain language is itself just PERL with a collection of library
   functions for creating platform objects included.  Your favorite aggregators
   are all here with constructors matching their normal token.  For convenience
   of e.g.  last, aggregators are also included with a prefixed underscore.

   Below you can find documentation on all the "built in" functions.  Most
   aggregators and deaggregators should be present with arguments comparable to
   their normal instantiation arugments, but with keyspec parameters replaced
   with valuations parameters.
   __FORMAT_TEXT__
HELP
}

sub _long_usage {
   return <<HELP;

Special Syntax
   __FORMAT_TEXT__
   Where one sees a <snippet> argument below, a string scalar is expected,
   however quoting these can get fairly difficult and they can be confused with
   non-<snippet> scalars.

   Example:
   __FORMAT_TEXT__
     --dla "ucancat(',', snip('{{x}} * 2'))"

   __FORMAT_TEXT__
   To remedy this, one may use <<code>> to inline a snippet which will be
   immediately understood by the typing mechanism as being code.  Escaping
   inside this is as single quotes in PERL.

   Example With <<CODE>>
   __FORMAT_TEXT__
     --dla 'uconcat(",", <<{{x}} * 2>>)'

Function Library
   ii_agg(<snippet>, <snippet>[, <snippet>])
   ii_aggregator(<snippet>, <snippet>[, <snippet>])
   inject_into_agg(<snippet>, <snippet>[, <snippet>])
   inject_into_aggregator(<snippet>, <snippet>[, <snippet>])
      __FORMAT_TEXT__
      Take an initial snippet, a combine snippet, and an optional squish
      snippet to produce an ad-hoc aggregator based on inject into.  The
      initial snippet produces the aggregate value for an empty collection,
      then combine takes \$a representing the aggregate value so far and \$r
      representing the next record to add and returns the new aggregate value.
      Finally, the squish snippet takes \$a representing the final aggregate
      value so far and produces the final answer for the aggregator.

      Example(s):
      __FORMAT_TEXT__
         Track count and sum to produce average:
            ii_agg(<<[0, 0]>>, <<[\$a->[0] + 1, \$a->[1] + {{ct}}]>>, <<\$a->[1] / \$a->[0]>>)

   for_field(qr/.../, <snippet>)
      __FORMAT_TEXT__
      Takes a regex and a snippet of code.  Creates an aggregator that creates
      a map.  Keys in the map correspond to fields chosen by matching the regex
      against the fields from input records.  Values in the map are produced by
      aggregators which the snippet must act as a factory for (\$f is the
      field).

      Example(s):
      __FORMAT_TEXT__
         To aggregate the sums of all the fields beginning with "t"
            for_field(qr/^t/, <<sum(\$f)>>)

   for_field(qr/.../, qr/.../, <snippet>)
      __FORMAT_TEXT__
      Takes two regexes and a snippet of code.  Creates an aggregator that
      creates a map.  Keys in the map correspond to pairs of fields chosen by
      matching the regexes against the fields from input records.  Values in
      the map are produced by aggregators which the snippet must act as a
      factory for (\$f1 is the first field, \$f2 is the second field).

      Example(s):
      __FORMAT_TEXT__
         To find the covariance of all x-named fields with all y-named fields:
            for_field(qr/^x/, qr/^y/, <<covar(\$f1, \$f2)>>)

   map_reduce_agg(<snippet>, <snippet>[, <snippet>])
   map_reduce_aggregator(<snippet>, <snippet>[, <snippet>])
   mr_agg(<snippet>, <snippet>[, <snippet>])
   mr_aggregator(<snippet>, <snippet>[, <snippet>])
      __FORMAT_TEXT__
      Take a map snippet, a reduce snippet, and an optional squish snippet to
      produce an ad-hoc aggregator based on map reduce.  The map snippet takes
      \$r representing a record and returns its mapped value.  The reduce
      snippet takes \$a and \$b representing two mapped values and combines
      them.  Finally, the squish snippet takes a mapped value \$a representing
      all the records and produces the final answer for the aggregator.

      Example(s):
      __FORMAT_TEXT__
         Track count and sum to produce average:
            mr_agg(<<[1, {{ct}}]>>, <<[\$a->[0] + \$b->[0], \$a->[1] + \$b->[1]]>>, <<\$a->[1] / \$a->[0]>>)

   rec()
   record()
      __FORMAT_TEXT__
      A valuation that just returns the entire record.
      __FORMAT_TEXT__

   snip(snip)
      __FORMAT_TEXT__
      Takes a snippet and returns both the snippet and the snippet as a
      valuation.  Used to distinguished snippets from scalars in cases where it
      matters, e.g.  min('{{x}}') interprets it is a keyspec when it was meant
      to be a snippet (and then a valuation), min(snip('{{x}}')) does what is
      intended.  This is used internally by <<...>> and in fact <<...>> just
      translates to snip('...').
      __FORMAT_TEXT__

   subset_agg(<snippet>, <aggregator>)
   subset_aggregator(<snippet>, <aggregator>)
      __FORMAT_TEXT__
      Takes a snippate to act as a record predicate and an aggregator and
      produces an aggregator that acts as the provided aggregator as run on the
      filtered view.

      Example(s):
      __FORMAT_TEXT__
          An aggregator that counts the number of records with a time not above 6 seconds:
             subset_agg(<<{{time_ms}} <= 6000>>, ct())

   type_agg(obj)
   type_scalar(obj)
   type_val(obj)
      __FORMAT_TEXT__
      Force the object into a specific type.  Can be used to force certain
      upconversions (or avoid them).
      __FORMAT_TEXT__

   valuation(sub { ... })
   val(sub { ... })
      __FORMAT_TEXT__
      Takes a subref, creates a valuation that represents it.  The subref will
      get the record as its first and only argument.
      __FORMAT_TEXT__

      Example(s):
         To get the square of the "x" field:
            val(sub{ \$[0]->{x} ** 2 })
HELP
}

1;
