package App::RecordStream::Operation::collate;

our $VERSION = "4.0.24";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Aggregator;
use App::RecordStream::Clumper::Options;
use App::RecordStream::DomainLanguage::Library;
use App::RecordStream::DomainLanguage::Snippet;
use App::RecordStream::DomainLanguage;
use App::RecordStream::Operation::collate::BaseClumperCallback;
use App::RecordStream::Operation;

sub init {
  my $this = shift;
  my $args = shift;

  App::RecordStream::Aggregator->load_implementations();

  # clumping
  my $clumper_options = $this->{'CLUMPER_OPTIONS'} = App::RecordStream::Clumper::Options->new();

  # aggregation
  my @aggregators;
  my %dlaggregators;
  my @mr_aggregators;
  my @ii_aggregators;
  my $incremental = 0;
  my $bucket = 1;

  # help
  my $list_aggregators = 0;
  my $aggregator = 0;

  my $spec = {
    $clumper_options->main_options(),

    # aggregation
    "aggregator|a=s"    => sub { push @aggregators, $_[1]; },
    "dlaggregator|A=s"  => sub { build_dlaggregator(\%dlaggregators, $_[1]); },
    "mr-agg=s{4}"       => \@mr_aggregators,
    "ii-agg=s{4}"       => \@ii_aggregators,
    "incremental|i"     => \$incremental,
    "bucket!"           => \$bucket,

    # help
    "list-aggregators"  => \$list_aggregators,
    "show-aggregator=s" => \$aggregator,
    $clumper_options->help_options(),
    "list"              => \$list_aggregators,
  };

  $this->parse_options($args, $spec);

  # check help first

  if ( $list_aggregators ) {
    die sub { print App::RecordStream::Aggregator->list_implementations(); };
  }

  if ( $aggregator ) {
    die sub { App::RecordStream::Aggregator->show_implementation($aggregator) };
  }

  my $aggregator_objects = App::RecordStream::Aggregator->make_aggregators(@aggregators);

  $aggregator_objects = {%$aggregator_objects, %dlaggregators};

  for(my $i = 0; $i < @mr_aggregators; 1) {
    my $name = $mr_aggregators[$i++];
    my $map_string = $mr_aggregators[$i++];
    my $reduce_string = $mr_aggregators[$i++];
    my $squish_string = $mr_aggregators[$i++];

    my $map_snippet = App::RecordStream::DomainLanguage::Snippet->new($map_string);
    my $reduce_snippet = App::RecordStream::DomainLanguage::Snippet->new($reduce_string);
    my $squish_snippet = App::RecordStream::DomainLanguage::Snippet->new($squish_string);

    $aggregator_objects->{$name} = App::RecordStream::DomainLanguage::Library::map_reduce_aggregator($map_snippet, $reduce_snippet, $squish_snippet);
  }

  for(my $i = 0; $i < @ii_aggregators; 1) {
    my $name = $ii_aggregators[$i++];
    my $initial_string = $ii_aggregators[$i++];
    my $combine_string = $ii_aggregators[$i++];
    my $squish_string = $ii_aggregators[$i++];

    my $initial_snippet = App::RecordStream::DomainLanguage::Snippet->new($initial_string);
    my $combine_snippet = App::RecordStream::DomainLanguage::Snippet->new($combine_string);
    my $squish_snippet = App::RecordStream::DomainLanguage::Snippet->new($squish_string);

    $aggregator_objects->{$name} = App::RecordStream::DomainLanguage::Library::inject_into_aggregator($initial_snippet, $combine_snippet, $squish_snippet);
  }

  $clumper_options->check_options(App::RecordStream::Operation::collate::BaseClumperCallback->new($aggregator_objects, $incremental, $bucket, sub { $this->push_record($_[0]); }));
}

sub build_dlaggregator {
  my $dlaggregators_ref = shift;
  my $string = shift;

  my $name;
  if($string =~ s/^([^=]*)=//) {
    $name = $1;
  }
  else {
    die "Bad domain language aggregator option (missing '=' to separate name and code): " . $string;
  }

  $dlaggregators_ref->{$name} = App::RecordStream::DomainLanguage::Snippet->new($string)->evaluate_as('AGGREGATOR');
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  $this->{'CLUMPER_OPTIONS'}->accept_record($record);
}

sub stream_done {
  my $this = shift;

  $this->{'CLUMPER_OPTIONS'}->stream_done();
}

sub print_usage {
  my $this    = shift;
  my $message = shift;

  if ( $message && UNIVERSAL::isa($message, 'CODE') ) {
    $message->();
    exit 1;
  }

  $this->SUPER::print_usage($message);
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('keyspecs');
  $this->use_help_type('keygroups');
  $this->use_help_type('keys');
  $this->use_help_type('domainlanguage');
  $this->use_help_type('clumping');
  $this->add_help_type(
    'aggregators',
    sub { print App::RecordStream::Aggregator->list_implementations(); },
    'List the aggregators'
  );
  $this->add_help_type(
    'more',
    sub { $this->more_help() },
    'Larger help documentation'
  );
}

sub usage {
  my $this = shift;

  my $options = [
    [ 'dlaggregator|-A ...', 'Specify a domain language aggregate.  See "Domain Language Integration" below.'],
    [ 'aggregator|-a <aggregators>', 'Colon separated list of aggregate field specifiers.  See "Aggregates" section below.'],
    [ 'mr-agg <name> <map> <reduce> <squish>', 'Specify a map reduce aggregator via 3 snippets, similar to mr_agg() from the domain language.'],
    [ 'ii-agg <name> <initial> <combine> <squish>', 'Specify an inject into aggregator via 3 snippets, similar to ii_agg() from the domain language.'],
    [ 'incremental', 'Output a record every time an input record is added to a clump (instead of every time a clump is flushed).'],
    [ '[no]-bucket', 'With --bucket outputs one record per clump, with --no-bucket outputs one record for each record that went into the clump.'],
    $this->{'CLUMPER_OPTIONS'}->main_usage(),

    [ 'list-aggregators|--list', 'Bail and output a list of aggregators' ],
    [ 'show-aggregator <aggregator>', 'Bail and output this aggregator\'s detailed usage.'],
    $this->{'CLUMPER_OPTIONS'}->help_usage(),
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE
Usage: recs-collate <args> [<files>]
   __FORMAT_TEXT__
   Take records, grouped togther by --keys, and compute statistics (like
   average, count, sum, concat, etc) within those groups.

   For starting with collate, try doing single --key collates with some number
   of aggregators (list available in --list-agrregators)
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Count clumps of adjacent lines with matching x fields.
      recs-collate --adjacent --key x --aggregator count
   Count number of each x field value in the entire file.
      recs-collate --key x --aggregator count
   Finds the maximum latency for each date, hour pair
      recs-collate --key date,hour --aggregator worst_latency=max,latency
   Find the median value of x+y in records
      recs-collate --dlaggregator "m=perc(50,snip(<<{{x}}+{{y}}>>))"
USAGE
}

sub more_help {
  my $this = shift;
  my $usage = $this->usage() . <<USAGE;

Aggregates:
   __FORMAT_TEXT__
   Aggregates are specified as [<fieldname>=]<aggregator>[,<arguments>].  The
   default field name is aggregator and arguments joined by underscores.  See
   --list-aggregators for a list of available aggregators.

   Fieldname maybe a key spec. (i.e. foo/bar=sum,field).  Additionally, all key
   name arguments to aggregators maybe be key specs (i.e.
   foo=max,latency/url), but not key groups
   __FORMAT_TEXT__

Cubing:
   __FORMAT_TEXT__
   Instead of added one entry for each input record, we add 2 ** (number of key
   fields), with every possible combination of fields replaced with the default
   of "ALL".  This is not meant to be used with --adjacent or --size.  If our
   key fields were x and y then we'd get output records for {x = 1, y = 2}, {x
   = 1, y = ALL}, {x = ALL, y = 2} and {x = ALL, y = ALL}.
   __FORMAT_TEXT__

Domain Lanuage Integration:
USAGE
  $usage .= App::RecordStream::DomainLanguage::short_usage() . <<USAGE;

   __FORMAT_TEXT__
   Either aggregates or keys may be specified using the recs domain language.
   Both --dlkey and --dlaggregator require an options of the format
   '<name>=<domain language code>'.  --dlkey requires the code evaluate as a
   valuation, --dlaggregator requires the code evaluate as an aggregator.

   See --help-domainlanguage for a more complete description of its workings
   and a list of available functions.

   See the examples below for a more gentle introduction.
   __FORMAT_TEXT__

Examples:
   Count clumps of adjacent lines with matching x fields.
      recs-collate --adjacent --key x --aggregator count
   Count number of each x field in the entire file.
      recs-collate --key x --aggregator count
   Count number of each x field in the entire file, including an "ALL" line.
      recs-collate --key x --aggregator count --cube
   Produce a cummulative sum of field profit up to each date
      recs-collate --key date --adjacent --incremental --aggregator profit_to_date=sum,profit
   Produce record count for each date, hour pair
      recs-collate --key date,hour --aggregator count
   Finds the maximum latency for each date, hour pair
      recs-collate --key date,hour --aggregator worst_latency=max,latency
   Produce a list of hosts in each datacenter.
      recs-collate --key dc --dlaggregator "hosts=uconcat(', ', 'host')"
   Sum all time fields
      recs-collate --key ... --dlaggregator 'times=for_field(qr/^t/, <<sum(\$f)>>)'
   Find the median value of x+y in records
      recs-collate --dlaggregator "m=perc(50,snip(<<{{x}}+{{y}}>>))"
   Count people by first three letters of their name
      recs-collate --dlkey "tla=<<substr({{name}},0,3)>>" -a ct
USAGE
  print $this->format_usage($usage);
}

1;
