package App::RecordStream::Operation::multiplex;

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Clumper::CubeKeyPerfect;
use App::RecordStream::Clumper::KeyLRU;
use App::RecordStream::Clumper::KeyPerfect;
use App::RecordStream::Clumper::WrappedClumperCallback;
use App::RecordStream::Clumper;
use App::RecordStream::DomainLanguage::Snippet;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;
use App::RecordStream::DomainLanguage;
use App::RecordStream::KeyGroups;
use App::RecordStream::Operation::multiplex::BaseClumperCallback;

sub init {
  my $this = shift;
  my $args = shift;

  App::RecordStream::Clumper->load_implementations();

  # options for old-style clumping
  my $size = undef;
  my $cube = 0;

  my @clumpers;

  my $line_key = undef;

  # help
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

    # other options
    "line-key|L=s"          => \$line_key,

    # help
    "list-clumpers"     => \$list_clumpers,
    "show-clumper=s"    => \$clumper,
  };

  $this->parse_options($args, $spec);

  my ($script, @args) = @$args;
  @$args = ();

  # check help first

  if ( $list_clumpers ) {
    die sub { print App::RecordStream::Clumper->list_implementations(); };
  }

  if ( $clumper ) {
    die sub { App::RecordStream::Clumper->show_implementation($clumper) };
  }

  $this->{'CLUMPER_CALLBACK'} = App::RecordStream::Operation::multiplex::BaseClumperCallback->new($script, \@args, $line_key, sub { return $this->push_record($_[0]); }, sub { return $this->push_line($_[0]); });
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

      $cb = App::RecordStream::Clumper::WrappedClumperCallback->new($clumper, $cb);
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

  return App::RecordStream::Clumper::WrappedClumperCallback->new($clumper, $cb);
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
    [ 'size|--sz|-n <number>', 'Number of running clumps to keep.'],
    [ 'adjacent|-1', 'Only group together adjacent records.  Avoids spooling records into memeory'],
    [ 'cube', 'See "Cubing" section in --help-more.'],
    [ 'incremental', 'Output a record every time an input record is added to a clump (instead of everytime a clump is flushed).'],
    [ 'clumper ...', 'Use this clumper to group records.  May be specified multiple times.  See --help-clumping.'],
    [ 'dlclumper ...', 'Use this domain language clumper to group records.  May be specified multiple times.  See --help-clumping.'],
    [ 'line-key|-L <key>', 'Rather than writing each record to its nested operation, feed this key as a line.'],
    [ 'list-clumpers', 'Bail and output a list of clumpers' ],
    [ 'show-clumper <clumper>', 'Bail and output this clumper\'s detailed usage.'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE
Usage: recs-multiplex <args> -- <other recs operation>
   __FORMAT_TEXT__
   Take records, grouped togther by --keys, and run an operation for each
   group.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Separate out a stream of text by PID into separate invocations of recs-frommultire.
      recs-fromre '^(.*PID=([0-9]*).*)\$' -f line,pid | recs-multiplex -L line -k pid -- recs-frommultire ...
  Tag lines with counts by thread
      recs-multiplex -k thread -- recs-eval '{{nbr}} = ++\$nbr'
USAGE
}

sub more_help {
  my $this = shift;
  my $usage = $this->usage() . <<USAGE;

Domain Lanuage Integration:
   __FORMAT_TEXT__
USAGE
  $usage .= App::RecordStream::DomainLanguage::short_usage() . <<USAGE;

   Keys may be specified using the recs domain language.  --dlkey requires an
   option of the format '<name>=<domain language code>'.  --dlkey requires the
   code evaluate as a valuation.

   See --help-domainlanguage for a more complete description of its workings
   and a list of available functions.

   See the examples in the recs-collate help for a more gentle introduction.
   __FORMAT_TEXT__
USAGE
  print $this->format_usage($usage);
}

1;
