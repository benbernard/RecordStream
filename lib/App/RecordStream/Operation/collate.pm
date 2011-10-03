package App::RecordStream::Operation::collate;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Aggregator::Last;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage;
use App::RecordStream::DomainLanguage::Executor;
use App::RecordStream::DomainLanguage::Library;
use App::RecordStream::DomainLanguage::Value;
use App::RecordStream::LRUSheriff;

sub init {
   my $this = shift;
   my $args = shift;

   App::RecordStream::Aggregator::load_aggregators();

   my @aggregators;
   my %dlaggregators;
   my $size = undef;
   my $cube = 0;
   my $cube_default = "ALL";
   my $ignore_null_keys = 0;
   my $incremental = 0;
   my $list_aggregators = 0;
   my $aggregator = 0;

   my $key_groups = App::RecordStream::KeyGroups->new();
   my %dlkeys;

   my $spec = {
      "key|k=s"           => sub { $key_groups->add_groups($_[1]); },
      "dlkey=s"           => sub { build_dlkey(\%dlkeys, $_[1]); },
      "ignore-null"       => \$ignore_null_keys,
      "aggregator|a=s"    => sub { push @aggregators, split(/:/, $_[1]); },
      "dlaggregator=s"    => sub { build_dlaggregator(\%dlaggregators, $_[1]); },
      "size|sz|n=i"       => \$size,
      "adjacent|1"        => sub { $size = 1; },
      "cube|c"            => \$cube,
      "cube-default=s"    => \$cube_default,
      "incremental|i"     => \$incremental,
      "list-aggregators"  => \$list_aggregators,
      "show-aggregator=s" => \$aggregator,

      #Perfect kept for cli backwards compatability (it is default now)
      "perfect|p"         => sub { $size = undef; },
   };

   $this->parse_options($args, $spec);

   if ( $list_aggregators ) {
      die sub { App::RecordStream::Aggregator::list_aggregators(); };
   }

   if ( $aggregator ) {
      die sub { App::RecordStream::Aggregator::show_aggregator($aggregator) };
   }

   die "Must specify --key or --dlkey or --aggregator or --dlaggregator\n" unless ( $key_groups->has_any_group() || %dlkeys || @aggregators || %dlaggregators );

   my $aggregator_objects = App::RecordStream::Aggregator::make_aggregators(@aggregators);

   $aggregator_objects = {%$aggregator_objects, %dlaggregators};

   my $lru_sheriff = App::RecordStream::LRUSheriff->new();

   $this->{'KEY_GROUPS'}         = $key_groups;
   $this->{'DLKEYS'}             = \%dlkeys;
   $this->{'IGNORE_NULL'}        = $ignore_null_keys;
   $this->{'AGGREGATORS'}        = $aggregator_objects;
   $this->{'SIZE'}               = $size;
   $this->{'CUBE'}               = $cube;
   $this->{'INCREMENTAL'}        = $incremental;
   $this->{'LRU_SHERIFF'}        = $lru_sheriff;
   $this->{'CUBE_DEFAULT'}       = $cube_default;
   $this->{'SEEN_RECORD'}        = 0;
}

sub build_dlkey {
   my $dlkeys_ref = shift;
   my $string = shift;

   my $name;
   if($string =~ s/^([^=]*)=//) {
      $name = $1;
   }
   else {
      die "Bad domain language key option: " . $string;
   }

   $dlkeys_ref->{$name} = App::RecordStream::DomainLanguage::Snippet->new($string)->evaluate_as('VALUATION');
}

sub build_dlaggregator {
   my $dlaggregators_ref = shift;
   my $string = shift;

   my $name;
   if($string =~ s/^([^=]*)=//) {
      $name = $1;
   }
   else {
      die "Bad domain language aggregator option: " . $string;
   }

   $dlaggregators_ref->{$name} = App::RecordStream::DomainLanguage::Snippet->new($string)->evaluate_as('AGGREGATOR');
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   if ( !$this->{'SEEN_RECORD'} ) {
     $this->{'SEEN_RECORD'} = 1;
     $this->{'KEYS'} = $this->{'KEY_GROUPS'}->get_keyspecs($record);
   }

   my $record_keys = $this->get_keys($record);

   if ( $this->{'IGNORE_NULL'} ) {
      for (my $i = 0; $i < @{$this->{'KEYS'}}; $i++) {
         my $key = @{$this->{'KEYS'}}[$i];
         if (!defined(@{$record_keys}[$i])) {
            @{$record_keys}[$i] = "";
         }
      }
   }

   if ( $this->{'CUBE'} ) {
      $this->deep_put([], $record_keys, $record);
   }
   else {
      $this->put($record_keys, $record);
   }

   return 1;
}

sub canonicalize {
   my $this = shift;
   my $keys = shift;
   return join("\x1E", @$keys);
}

sub deep_put {
   my $this         = shift;
   my $search_keys  = shift;
   my $record_keys  = shift;
   my $record       = shift;

   if(@$search_keys == @$record_keys)
   {
      $this->put([@$search_keys], $record);
      return;
   }

   push @$search_keys, $this->{'CUBE_DEFAULT'};
   $this->deep_put($search_keys, $record_keys, $record);
   pop @$search_keys;

   push @$search_keys, $record_keys->[scalar @$search_keys];
   $this->deep_put($search_keys, $record_keys, $record);
   pop @$search_keys;
}

sub put {
   my $this        = shift;
   my $record_keys = shift;
   my $record      = shift;

   my $lru_sheriff = $this->{'LRU_SHERIFF'};
   my $aggregators  = $this->{'AGGREGATORS'};

   my $key   = $this->canonicalize($record_keys);
   my $value = $lru_sheriff->find($key);

   my $aggregator_values;


   if ( !$value ) {
      $aggregator_values = App::RecordStream::Aggregator::map_initial($aggregators);
      $value             = [$aggregator_values, $record_keys];

      $lru_sheriff->put($key, $value);
   }
   else {
      $aggregator_values = $value->[0];
   }

   $value->[0] = App::RecordStream::Aggregator::map_combine($aggregators, $aggregator_values, $record);

   if ( $this->{'INCREMENTAL'} ) {
      $this->output(@$value);
   }


   if ( defined($this->{'SIZE'}) ) {
      $this->purge();
   }
}

sub stream_done {
   my $this = shift;
   $this->purge(0);
}

sub purge {
   my $this = shift;
   my $size = shift;

   if ( not defined $size ) {
      $size = $this->{'SIZE'};
   }

   my @goners = $this->{'LRU_SHERIFF'}->purgenate($size);
   if ( !$this->{'INCREMENTAL'} ) {
      foreach my $value (@goners) {
         $this->output(@$value);
      }
   }
}

sub output {
   my $this              = shift;
   my $aggregaotr_values = shift;
   my $record_keys       = shift;

   my $aggregators  = $this->{'AGGREGATORS'};

   my $record = App::RecordStream::Aggregator::map_squish($aggregators, $aggregaotr_values);

   my $next_value_index = 0;

   # first key groups
   my $keys = $this->{'KEYS'};
   for my $key (@$keys) {
      ${$record->guess_key_from_spec($key)} = $record_keys->[$next_value_index++];
   }

   # then domain language keys
   for my $dlkey (sort(keys(%{$this->{'DLKEYS'}}))) {
      $record->{$dlkey} = $record_keys->[$next_value_index++];
   }

   $this->push_record($record);
}


sub get_keys {
   my $this   = shift;
   my $record = shift;

   # first key groups
   my @keys = map { ${$record->guess_key_from_spec($_)} } @{$this->{'KEYS'}};

   # then domain language keys
   for my $dlkey (sort(keys(%{$this->{'DLKEYS'}}))) {
      my $dlkey_valuation = $this->{'DLKEYS'}->{$dlkey};
      my $dlkey_value = $dlkey_valuation->evaluate_record($record);
      push @keys, $dlkey_value;
   }

   return \@keys;
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
   $this->add_help_type(
     'aggregators',
     sub { App::RecordStream::Aggregator::list_aggregators(); },
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
      [ 'dlkey ...', 'Specify a domain language key.  See "Domain Language Integration" below.'],
      [ 'dlaggregator ...', 'Specify a domain language aggregate.  See "Domain Language Integration" below.'],
      [ 'aggregator|-a <aggregators>', 'Colon separated list of aggregate field specifiers.  See "Aggregates" section below.'],
      [ 'size|--sz|-n <number>', 'Number of running clumps to keep.'],
      [ 'adjacent|-1', 'Only group together adjacent records.  Avoids spooling records into memeory'],
      [ 'cube', 'See "Cubing" section below.'],
      [ 'cube-default', 'See "Cubing" section below.'],
      [ 'incremental', 'Output a record every time an input record is added to a clump (instead of everytime a clump is flushed).'],
      [ 'list-aggregators', 'Bail and output a list of aggregators' ],
      [ 'show-aggregator <aggregator>', 'Bail and output this aggregator\'s detailed usage.'],
      [ 'ignore-null', 'Ignore undefined or non-existant keys in records'],
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
   (which defaults to "ALL" but can be specified with --cube-default).  This is
   not meant to be used with --adjacent or --size.  If our key fields were x
   and y then we'd get output records for {x = 1, y = 2}, {x = 1, y = ALL}, {x
   = ALL, y = 2} and {x = ALL, y = ALL}.
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
      recs-collate --key date --adjcent --incremental --aggregator profit_to_date=sum,profit
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
