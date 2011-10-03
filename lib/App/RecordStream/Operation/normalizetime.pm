package App::RecordStream::Operation::normalizetime;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

use Date::Manip qw (ParseDate UnixDate ParseDateDelta Delta_Format);

sub init {
   my $this = shift;
   my $args = shift;

   my $key;
   my $threshold;
   my $strict;
   my $epoch;

   my $spec = {
      "key|k=s"       => \$key,
      "strict|s"      => \$strict,
      "epoch|e"       => \$epoch,
      "threshold|n=s" => \$threshold,
   };

   $this->parse_options($args, $spec);

   die('Must specify --key') unless ( $key );
   die('Must specify --threshold') unless ( $threshold );

   # if threshold is not a number, assume its a parsable string
   if ( not ($threshold =~ m/^[0-9.]+$/) )
   {
      my $delta = ParseDateDelta($threshold);
      $threshold = Delta_Format($delta, 0, '%st');

      unless ( $threshold =~ m/^[0-9.]+$/ ) {
         die "Threshold passed isn't a number or parsable, "
         . "see perldoc Date::Manip for parseable formats\n";
      }
   }

   my $sanitized_key = $key;
   $sanitized_key =~ s!/!_!;

   $this->{'KEY'}           = $key;
   $this->{'SANITIZED_KEY'} = $sanitized_key;
   $this->{'STRICT'}        = $strict;
   $this->{'EPOCH'}         = $epoch;
   $this->{'THRESHOLD'}     = $threshold;
}


sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $key                    = $this->{'KEY'};
   my $threshold              = $this->{'THRESHOLD'};
   my $strict                 = $this->{'STRICT'};
   my $sanitized_key          = $this->{'SANITIZED_KEY'};
   my $prior_normalized_value = $this->{'PRIOR_NORMALIZED_VALUE'};

   my $value = ${$record->guess_key_from_spec($key)};

   my $time = $value;
   if ( ! $this->{'EPOCH'} ) {
     $time = UnixDate( ParseDate( $value ), "%s" );
     die "I can't understand Key: $key, with value: $value" unless $time;
   }

   my $normalized_time_cur_period = int( $time / $threshold ) * $threshold;
   my $normalized_time_prior_period = $normalized_time_cur_period - $threshold;

   my $normalized_time;
   if( !$strict && defined( $prior_normalized_value ) && $prior_normalized_value == $normalized_time_prior_period ) {
     $normalized_time = $prior_normalized_value;
   } else {
     $normalized_time = $normalized_time_cur_period;
     $prior_normalized_value = $normalized_time_cur_period;
     $this->{'PRIOR_NORMALIZED_VALUE'} = $normalized_time_cur_period;
   }

   $record->{"n_$sanitized_key"} = $normalized_time;
   $this->push_record($record);

   return 1;
}

sub add_help_types {
   my $this = shift;

   $this->use_help_type('keyspecs');
   $this->add_help_type(
      'full',
      \&full_help,
      'Indepth description of normalization alogrithm'
   );
}

sub full_help {
   print <<FULL_HELP;
Full Help

This recs processor will generate normalized versions of date/time values and
add this value as another attribute to the record stream.  Used in conjunction
with recs-collate you can aggregate information over the normalized time.  For
example if you use
   recs-normalized -k date --n 1 | recs-collate -k n_date -a firstrec
then this picks a single record from a stream to serve in placement of lots of
records which are close to each other in time.

The normalized time value generated depends on whether or not you are using
strict normalization or not.  The default is to use non-strict.

The use of the optional --epoch argument indicates that the date/time values
are expressed in epoch seconds.  This argument both speeds up the execution of
an invocation (due to avoiding the expensive perl Date:Manip executions) and is
required for correctness when the values are epoch seconds.

1.  When using strict normalization then time is chunked up into fixed segments
of --threshold seconds in each segment with the first segment occurring on
January 1st 1970 at 0:00.  So if the threshold is 60 seconds then the following
record stream would be produced

  date      n_date
  1:00:00   1:00:00
  1:00:14   1:00:00
  1:00:59   1:00:00
  1:02:05   1:02:00
  1:02:55   1:02:00
  1:03:15   1:03:00


2.  When not using strict normalization then the time is again chunked up into
fixed segments however the actual segment assigned to a value depends on the
segement chunk seen in the prior record.

The logic used is the following:
  - a time is distilled down to a representative sample where the precision is
    defined by the --threshold.  For example if you said that the threshold is
    10 (seconds) then 10:22:01 and 10:22:09 would both become 10:22:00.  10:22:10
    would be 10:22:10.
  - as you can tell the representative values is the first second within the range
    that you define, with one exception
  - if the representative value of the prior record is in the prior range to the
    current representative value then the prior record value will be used

So if the threshold is 60 seconds then the following record stream would be produced

  date      n_date
  1:00:00   1:00:00
  1:00:59   1:00:00
  1:02:05   1:02:00
  1:02:55   1:02:00
  1:03:15   1:02:00     ** Note - still matches prior representative value               **
  1:05:59   1:05:00
  1:06:15   1:05:00     ** Note - matches prior entry                                    **
  1:07:01   1:07:00     ** Note - since the 1:05 and 1:06 had the same representative    **
                        ** value then this is considered a new representative time slice **

Basically a 60 second threshold will match the current minute and the next minute unless
the prior minute was seen and then the 60 second threshold matches the current minute and
the prior minute.


Example usage: if you have log records for "out of memory" exceptions which may occur multiple
times because of exception catching and logging then you can distill them all down to a
single logical event and then count the number of occurrences for a host via:

   grep "OutOfMemory" logs |\
      recs-frommultire --re 'host=@([^:]*):' --re 'date=^[A-Za-z]* (.*) GMT ' |\
      recs-normalizetime --key date --threshold 300 | \
      recs-collate --perfect --key n_date -a firstrec | \
      recs-collate --perfect --key firstrec_host -a count=count

FULL_HELP
}

sub usage {
   my $this = shift;

   my $options = [
      ['key|-k <key>', 'Single Key field containing the date/time may be a key spec, see \'--help-keyspecs\' for more info'],
      ['epoch|-e', 'Assumes date/time field is expressed in epoch seconds (optional, defaults to non-epoch)'],
      ['threshold|-n <time range>', 'Number of seconds in the range.  May also be a duration string like \'1 week\' or \'5 minutes\', parsable by Date::Manip'],
      ['strict|-s', 'Apply strict normalization (defaults to non-strict)'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-normalizetime <args> [<files>]
   __FORMAT_TEXT__
   Given a single key field containing a date/time value this recs processor
   will construct a normalized version of the value and place this new value
   into a field named "n_<key>" (where <key> is the key field appearing in
   the args).
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   # Tag records with normalized time in 5 minute buckets from the date field
   ... | recs-normalizetime --strict --key date -n 300

   # Normalize time with fuzzy normalization into 1 minute buckets from the
   # epoch-relative 'time' field
   ... | recs-normalizetime --key time -e -n 60

   #Get 1 week buckets
   ... | recs-normalizetime --key timestamp -n '1 week'
USAGE
}

1;
