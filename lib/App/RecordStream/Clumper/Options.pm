package App::RecordStream::Clumper::Options;

use strict;
use warnings;

use App::RecordStream::Clumper::CubeKeyPerfect;
use App::RecordStream::Clumper::KeyLRU;
use App::RecordStream::Clumper::KeyPerfect;
use App::RecordStream::Clumper::WrappedClumperCallback;
use App::RecordStream::Clumper;
use App::RecordStream::DomainLanguage::Snippet;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;
use App::RecordStream::KeyGroups;

sub new {
  my $class = shift;

  App::RecordStream::Clumper->load_implementations();

  my $this = {
    # options for old-style clumping
    'KEY_SIZE' => undef,
    'KEY_CUBE' => 0,

    'TBD' => [],

    # help
    'HELP_LIST' => 0,
    'HELP_SHOW' => 0,
  };

  bless $this, $class;

  return $this;
}

sub main_options {
  my $this = shift;

  my $clumpers = $this->{'TBD'};

  return (
    # old style clumping
    "key|k=s"       => sub { push @$clumpers, ['KEYGROUP', $_[1]]; },
    "dlkey|K=s"     => sub { push @$clumpers, ['VALUATION', _build_dlkey($_[1])]; },
    "size|sz|n=i"   => \($this->{'KEY_SIZE'}),
    "adjacent|1"    => sub { $this->{'KEY_SIZE'} = 1; },
    "cube"          => \($this->{'KEY_CUBE'}),

    # new style clumping
    "clumper|c=s"   => sub { push @$clumpers, ['CLUMPER', App::RecordStream::Clumper->make_clumper($_[1])]; },
    "dlclumper|C=s" => sub { push @$clumpers, ['CLUMPER', _build_dlclumper($_[1])]; },
  );
}

sub help_options {
  my $this = shift;

  return (
    "list-clumpers"  => \($this->{'HELP_LIST'}),
    "show-clumper=s" => \($this->{'HELP_SHOW'}),
  );
}

sub check_options {
  my $this = shift;
  my $clumper_callback = shift;

  if($this->{'HELP_LIST'}) {
    die sub { print App::RecordStream::Clumper->list_implementations(); };
  }

  if($this->{'HELP_SHOW'}) {
    die sub { App::RecordStream::Clumper->show_implementation($this->{'HELP_SHOW'}) };
  }

  $this->{'CALLBACK'} = $clumper_callback;
  $this->{'CALLBACK_COOKIE'} = undef;
}

sub _build_dlkey {
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

sub _build_dlclumper {
  my $string = shift;

  return App::RecordStream::DomainLanguage::Snippet->new($string)->evaluate_as('CLUMPER');
}

sub _get_cb_and_cookie {
  my $this = shift;

  my $cb = $this->{'CALLBACK'};
  my $cookie = $this->{'CALLBACK_COOKIE'};
  if(!defined($cookie)) {
    $cookie = $this->{'CALLBACK_COOKIE'} = $cb->clumper_callback_begin({});
  }

  return ($cb, $cookie);
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  my $clumpers = $this->{'TBD'};
  while(@$clumpers) {
    my $clumper_tuple = pop @$clumpers;
    my ($type, @rest) = @$clumper_tuple;

    my $cb = $this->{'CALLBACK'};

    if(0) {
    }
    elsif($type eq 'KEYGROUP') {
      my ($group_spec) = @rest;

      my $key_groups = App::RecordStream::KeyGroups->new();
      $key_groups->add_groups($group_spec);
      my $keys = $key_groups->get_keyspecs($record);

      for my $spec (@$keys) {
        $cb = $this->_wrap_key_cb($spec, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($spec), $cb);
      }
    }
    elsif($type eq 'VALUATION') {
      my ($name, $val) = @rest;

      $cb = $this->_wrap_key_cb($name, $val, $cb);
    }
    elsif($type eq 'CLUMPER') {
      my ($clumper) = @rest;

      $cb = App::RecordStream::Clumper::WrappedClumperCallback->new($clumper, $cb);
    }
    else {
      die "Internal error";
    }

    $this->{'CALLBACK'} = $cb;
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

  my $size = $this->{'KEY_SIZE'};
  my $cube = $this->{'KEY_CUBE'};

  my $clumper;
  if($cube) {
    if(defined($size)) {
      die "--cube with --size (or --adjacent) is no longer a thing (and it never made sense)";
    }
    $clumper = App::RecordStream::Clumper::CubeKeyPerfect->new_from_valuation($name, $val);
  }
  elsif(defined($size)) {
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

sub main_usage {
  return (
    [ 'key|-k <keys>', 'Comma separated list of key fields.  May be a key spec or key group'],
    [ 'dlkey|-K ...', 'Specify a domain language key.  See "Domain Language Integration" section in --help-more.'],
    [ 'size|--sz|-n <number>', 'Number of running clumps to keep.'],
    [ 'adjacent|-1', 'Only group together adjacent records.  Avoids spooling records into memeory'],
    [ 'cube', 'See "Cubing" section in --help-more.'],
    [ 'clumper ...', 'Use this clumper to group records.  May be specified multiple times.  See --help-clumping.'],
    [ 'dlclumper ...', 'Use this domain language clumper to group records.  May be specified multiple times.  See --help-clumping.'],
  );
}

sub help_usage {
  return (
    [ 'list-clumpers', 'Bail and output a list of clumpers' ],
    [ 'show-clumper <clumper>', 'Bail and output this clumper\'s detailed usage.'],
  );
}

1;
