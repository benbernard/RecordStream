use strict;
use warnings;

package App::RecordStream::Operation::parsedate;
use base qw(App::RecordStream::Operation);
use App::RecordStream::KeyGroups;

use Time::ParseDate qw< parsedate >;
use POSIX qw< strftime tzset >;

sub init {
  my $this = shift;
  my $args = shift;

  $this->{'KEYS'} = App::RecordStream::KeyGroups->new;
  $this->{'INPUT_TIMEZONE'}  = $ENV{TZ};
  $this->{'OUTPUT_TIMEZONE'} = $ENV{TZ};

  # Using a single "now" is important if we're processing a lot of relative
  # dates so that "now" doesn't drift during processing.  time() is the
  # default, anyway.
  $this->{'NOW'} = time;

  my $options = {
    'key|k=s'       => sub { $this->{'KEYS'}->add_groups($_[1]) },
    'format|f=s'    => \($this->{'FORMAT'}),
    'iso|iso8601'   => sub { $this->{'FORMAT'} = '%FT%T%z' },
    'epoch'         => sub { $this->{'FORMAT'} = '%s' },
    'pretty'        => sub { $this->{'FORMAT'} = '%c' },
    'dmy'           => \($this->{'UK'}),
    'past'          => \($this->{'PAST'}),
    'future'        => \($this->{'FUTURE'}),
    'relative!'     => \($this->{'RELATIVE'}),
    'now=i'         => \($this->{'NOW'}),
    'from-tz=s'     => \($this->{'INPUT_TIMEZONE'}),
    'to-tz=s'       => \($this->{'OUTPUT_TIMEZONE'}),
    'tz=s'          => sub { $this->{'OUTPUT_TIMEZONE'} = $this->{'INPUT_TIMEZONE'} = $_[1] },
  };
  $this->parse_options($args, $options);

  die "--key is required\n"
    unless $this->{'KEYS'}->has_any_group;

  die "--format (or one of --iso, --epoch, or --pretty) is required\n"
    unless defined $this->{'FORMAT'};
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  my @values = map { $record->guess_key_from_spec($_) }
    @{ $this->{'KEYS'}->get_keyspecs_for_record($record) };

  for my $date (@values) {
    my $epoch = $this->parse_date($$date);
    $$date = $this->format_epoch($epoch);
  }

  $this->push_record($record);
  return 1;
}

sub parse_date {
  my ($this, $date) = @_;

  my ($epoch, $status) = $this->with_tz(
    $this->{'INPUT_TIMEZONE'},
    sub {
      # It might seem that we could pass our timezone to parsedate()'s ZONE
      # parameter, but it has very limited capacity for supported timezone
      # strings.  For example, PST is supported but America/Los_Angeles is not.
      # On the other hand, if you let it default to the environmental TZ, it
      # can do the right math using standard functions.  \o/

      parsedate(
        $date,
        WHOLE           => 1,
        VALIDATE        => 1,
        PREFER_PAST     => $this->{'PAST'},
        PREFER_FUTURE   => $this->{'FUTURE'},
        NO_RELATIVE     => !$this->{'RELATIVE'},
        UK              => $this->{'UK'},
        NOW             => $this->{'NOW'},
      );
    }
  );

  warn "Unable to parse '$date': $status\n"
    unless defined $epoch;

  return $epoch;
}

sub format_epoch {
  my ($this, $epoch) = @_;
  my $formatted;

  return undef
    unless defined $epoch;

  return scalar $this->with_tz(
    $this->{'OUTPUT_TIMEZONE'},
    sub {
      # Since we're operating in our desired output timezone, we use the
      # localtime function (instead of gmtime).  It's also important that
      # localtime and strftime run under the same TZ, so localtime must be in
      # this block.

      strftime($this->{'FORMAT'}, localtime $epoch);
    }
  );
}

sub with_tz {
  my ($this, $tz, $code) = @_;
  my @return;

  # Set TZ locally and restore it when we exit the block to
  # avoid side-effects elsewhere.
  {
    local $ENV{TZ} = $tz;
    tzset();

    @return = $code->();
  }

  # By now $ENV{TZ} is back to what it was, thanks to local(),
  # so make sure everything sees the restored value again.
  tzset();

  return wantarray ? @return : $return[0];
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('keyspecs');
  $this->use_help_type('keygroups');
  $this->use_help_type('keys');
}

sub usage {
  my $this = shift;
  my $options = [
    ['key|-k <keys>',        'Datetime keys to parse and reformat; may be a key spec or key group.  Required.'],
    ['format|-f <strftime>', 'Format string for strftime(3).  Required.'],
    ['iso|--iso8601',        'Output datetimes as an ISO 8601 timestamp (equivalent to -f %FT%T%z)'],
    ['epoch',                'Output datetimes as the number of seconds since the epoch (equivalent to -f %s)'],
    ['pretty',               'Output datetimes in the locale-preferred format (equivalent to -f %c)'],
    ['dmy',                  'Assume dd/mm (UK-style) instead of mm/dd (US-style)'],
    ['past',                 'Assume ambiguous years and days of the week are in the past'],
    ['future',               'Assume ambiguous years and days of the week are in the future'],
    ['relative',             'Try to parse relative dates and times (e.g. 1 hour ago)'],
    ['now <integer>',        'Set the "current time" for relative datetimes, as seconds since the epoch (rarely needed)'],
    ['from-tz <zone>',       'Assume ambiguous datetimes are in the given timezone (defaults to the local TZ)'],
    ['to-tz <zone>',         'Convert datetimes to the given timezone for output (defaults to the local TZ)'],
    ['tz <zone>',            'Set both --from-tz and --to-tz to the same timezone at once'],
  ];
  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs parsedate -k <keys> -f <format> [<options>] [<files>]
   __FORMAT_TEXT__
   Parses the values of the specified keys and reformats them according to the
   specified strftime(3) format string.  Partial dates and times may be parsed.  A
   full list of formats parsed is provided in the documentation for
   Time::ParseDate [1].

   Times without a timezone are parsed in the current TZ, unless otherwise
   specified by --from-tz.  Times are output in the current TZ, unless
   otherwise specified by --to-tz.

   Values that cannot be parsed will be set to undef/null.

   If using --relative, you probably also want to specify --past or --future,
   otherwise your ambiguous datetimes (e.g. "Friday") won't be parsed.

   [1] https://metacpan.org/pod/Time::ParseDate#DATE-FORMATS-RECOGNIZED
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Normalize dates from a variety of formats to YYYY-MM-DD in UTC:
      ... | recs parsedate -k when -f "%Y-%m-%d" --to-tz UTC
   Convert timestamps in UTC to local time in an ISO 8601 format:
      ... | recs parsedate -k timestamp --from-tz UTC --iso8601
USAGE
}

1;
