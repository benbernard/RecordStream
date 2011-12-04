package App::RecordStream::Clumper;

use strict;
use lib;

use App::RecordStream::BaseRegistry;

use base ('App::RecordStream::BaseRegistry');

sub make_clumper
{
  my $registry_class = shift;
  my $spec = shift;

  return $registry_class->parse_single_nameless_implementation($spec);
}

sub typename
{
  return "clumper";
}

sub usage {
  my $this = shift;
  return <<USAGE;
CLUMPING:
   __FORMAT_TEXT__
   "Clumping" defines a way of taking a stream of input records and rearranging
   them into to groups for consideration.  The most common "consideration" for
   such a group of records is the application of one or more aggregators by
   recs-collate and the most common clumpers are those specifiable by
   recs-collate's normal options.  However, other recs scripts can use
   "clumpers" and much more complex clumping is possible.  A list of clumpers
   can be found via the --list-clumpers option on recs-collate and
   documentation for individual clumpers can be inspected via --show-clumper.
   __FORMAT_TEXT__

Examples:
   Group adjacent records for each host and output each such group's size.
      recs-collate -c keylru,host,1 -a ct
   Output the successive differences of the time field.
      recs-collate -c window,2 --dla 'time_delta=xform(recs, <<{{#1/time}} - {{#0/time}}>>)'
USAGE
}

1;
