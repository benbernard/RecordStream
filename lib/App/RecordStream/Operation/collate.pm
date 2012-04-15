package App::RecordStream::Operation::collate;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Aggregator::Last;
use App::RecordStream::Aggregator;
use App::RecordStream::Clumper::CubeKeyPerfect;
use App::RecordStream::Clumper::KeyLRU;
use App::RecordStream::Clumper::KeyPerfect;
use App::RecordStream::Clumper;
use App::RecordStream::DomainLanguage::Executor;
use App::RecordStream::DomainLanguage::Library;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;
use App::RecordStream::DomainLanguage::Value;
use App::RecordStream::DomainLanguage;
use App::RecordStream::Operation::collate::BaseClumperCallback;
use App::RecordStream::Operation::collate::WrappedClumperCallback;

sub init {
  my $this = shift;
  my $args = shift;

  App::RecordStream::Aggregator->load_implementations();
  App::RecordStream::Clumper->load_implementations();

  # options for old-style clumping
  my $size = undef;
  my $cube = 0;

  my @clumpers;

  # aggregation
  my @aggregators;
  my %dlaggregators;
  my @mr_aggregators;
  my @ii_aggregators;
  my $incremental = 0;

  # help
  my $list_aggregators = 0;
  my $aggregator = 0;
  my $list_clumpers = 0;
  my $clumper = 0;

  my $spec = {
    # old style clumping
    "key|k=s"           => sub { push @clumpers, ['KEYGROUP', $_[1]]; },
    "dlkey|K=s"         => sub { push @clumpers, ['VALUATION', build_dlkey($_[1])]; },
    "size|sz|n=i"       => \$size,
    "adjacent|1"        => sub { $size = 1; },
    "cube"              => \$cube,

    # new style clumping
    "clumper|c=s"       => sub { push @clumpers, ['CLUMPER', App::RecordStream::Clumper->make_clumper($_[1])]; },
    "dlclumper|C=s"     => sub { push @clumpers, ['CLUMPER', build_dlclumper($_[1])]; },

    # aggregation
    "aggregator|a=s"    => sub { push @aggregators, $_[1]; },
    "dlaggregator|A=s"  => sub { build_dlaggregator(\%dlaggregators, $_[1]); },
    "mr-agg=s{4}"       => \@mr_aggregators,
    "ii-agg=s{4}"       => \@ii_aggregators,
    "incremental|i"     => \$incremental,

    # help
    "list-aggregators"  => \$list_aggregators,
    "show-aggregator=s" => \$aggregator,
    "list-clumpers"     => \$list_clumpers,
    "show-clumper=s"    => \$clumper,
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

  if ( $list_clumpers ) {
    die sub { print App::RecordStream::Clumper->list_implementations(); };
  }

  if ( $clumper ) {
    die sub { App::RecordStream::Clumper->show_implementation($clumper) };
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

  $this->{'CLUMPER_CALLBACK'} = App::RecordStream::Operation::collate::BaseClumperCallback->new($aggregator_objects, $incremental, sub { $this->push_record($_[0]); });
  $this->{'CLUMPER_CALLBACK_COOKIE'} = undef;
  $this->{'CLUMPERS_TBD'} = \@clumpers;
  $this->{'KEY_CLUMPER_SIZE'} = $size;
  $this->{'KEY_CLUMPER_CUBE'} = $cube;
}

sub build_dlkey {
  my $string = shift;

  my $name;
  if($string =~ s/^([^=]*)=//) {
    $name = $1;
  }
  else {
    die "Bad domain language key option (missing '=' to separate name and code): " . $string;
  }

  return ($name, App::RecordStream::DomainLanguage::Snippet->new($string)->evaluate_as('VALUATION'));
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

sub build_dlclumper {
  my $string = shift;

  return App::RecordStream::DomainLanguage::Snippet->new($string)->evaluate_as('CLUMPER');
}

sub _get_cb_and_cookie {
  my $this = shift;

  my $cb = $this->{'CLUMPER_CALLBACK'};
  my $cookie = $this->{'CLUMPER_CALLBACK_COOKIE'};
  if ( !defined($cookie) ) {
    $cookie = $this->{'CLUMPER_CALLBACK_COOKIE'} = $cb->clumper_callback_begin({});
  }

  return ($cb, $cookie);
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  my $clumpers = $this->{'CLUMPERS_TBD'};
  while ( @$clumpers ) {
    my $clumper_tuple = pop @$clumpers;
    my ($type, @rest) = @$clumper_tuple;

    my $cb = $this->{'CLUMPER_CALLBACK'};

    if (0) {
    }
    elsif ( $type eq 'KEYGROUP' ) {
      my ($group_spec) = @rest;

      my $key_groups = App::RecordStream::KeyGroups->new();
      $key_groups->add_groups($group_spec);
      my $keys = $key_groups->get_keyspecs($record);

      for my $spec (@$keys)
      {
        $cb = $this->_wrap_key_cb($spec, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($spec), $cb);
      }
    }
    elsif ( $type eq 'VALUATION' ) {
      my ($name, $val) = @rest;

      $cb = $this->_wrap_key_cb($name, $val, $cb);
    }
    elsif ( $type eq 'CLUMPER' ) {
      my ($clumper) = @rest;

      $cb = App::RecordStream::Operation::collate::WrappedClumperCallback->new($clumper, $cb);
    }
    else {
      die "Internal error";
    }

    $this->{'CLUMPER_CALLBACK'} = $cb;
  }

  my ($cb, $cookie) = $this->_get_cb_and_cookie();

  $cb->clumper_callback_push_record($cookie, $record);

  return 1;
}

sub _wrap_key_cb {
  my $this = shift;
  my $name = shift;
  my $val = shift;
  my $cb = shift;

  my $size = $this->{'KEY_CLUMPER_SIZE'};
  my $cube = $this->{'KEY_CLUMPER_CUBE'};

  my $clumper;
  if ( $cube ) {
    if ( defined($size) ) {
      die "--cube with --size (or --adjacent) is no longer a thing (and it never made sense)";
    }
    $clumper = App::RecordStream::Clumper::CubeKeyPerfect->new_from_valuation($name, $val);
  }
  elsif ( defined($size) ) {
    $clumper = App::RecordStream::Clumper::KeyLRU->new_from_valuation($name, $val, $size);
  }
  else {
    $clumper = App::RecordStream::Clumper::KeyPerfect->new_from_valuation($name, $val);
  }

  return App::RecordStream::Operation::collate::WrappedClumperCallback->new($clumper, $cb);
}

sub stream_done {
  my $this = shift;

  my ($cb, $cookie) = $this->_get_cb_and_cookie();

  $cb->clumper_callback_end($cookie);
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
    [ 'key|-k <keys>', 'Comma separated list of key fields.  May be a key spec or key group'],
    [ 'dlkey|-K ...', 'Specify a domain language key.  See "Domain Language Integration" below.'],
    [ 'dlaggregator|-A ...', 'Specify a domain language aggregate.  See "Domain Language Integration" below.'],
    [ 'aggregator|-a <aggregators>', 'Colon separated list of aggregate field specifiers.  See "Aggregates" section below.'],
    [ 'mr-agg <name> <map> <reduce> <squish>', 'Specify a map reduce aggregator via 3 snippets, similar to mr_agg() from the domain language.'],
    [ 'ii-agg <name> <initial> <combine> <squish>', 'Specify an inject into aggregator via 3 snippets, similar to ii_agg() from the domain language.'],
    [ 'size|--sz|-n <number>', 'Number of running clumps to keep.'],
    [ 'adjacent|-1', 'Only group together adjacent records.  Avoids spooling records into memeory'],
    [ 'cube', 'See "Cubing" section in --help-more.'],
    [ 'incremental', 'Output a record every time an input record is added to a clump (instead of everytime a clump is flushed).'],
    [ 'clumper ...', 'Use this clumper to group records.  May be specified multiple times.  See --help-clumping.'],
    [ 'dlclumper ...', 'Use this domain language clumper to group records.  May be specified multiple times.  See --help-clumping.'],
    [ 'list-aggregators|--list', 'Bail and output a list of aggregators' ],
    [ 'show-aggregator <aggregator>', 'Bail and output this aggregator\'s detailed usage.'],
    [ 'list-clumpers', 'Bail and output a list of clumpers' ],
    [ 'show-clumper <clumper>', 'Bail and output this clumper\'s detailed usage.'],
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
   __FORMAT_TEXT__
USAGE
  $usage .= App::RecordStream::DomainLanguage::short_usage() . <<USAGE;

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
