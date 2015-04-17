use strict;
use warnings;
use Test::More;
use File::Basename qw< dirname >;
use File::Spec::Functions qw< catdir updir >;

my $testlib = catdir($ENV{BASE_TEST_DIR}, "lib");

# Defaults
{
  my $output = load_sites();
  unlike $output, qr/Recs::Site::INC/,        "not loaded INC.pm";
}

# Defaults, local @INC
{
  my $output = load_sites("-Mlib=$testlib");
  like   $output, qr/Recs::Site::INC/,        "    loaded INC.pm";
}

sub load_sites {
  # Use new processes to most robustly isolate repeated site loading
  require App::RecordStream::Site;
  my $ourlib = catdir(dirname($INC{"App/RecordStream/Site.pm"}), updir, updir);

  # Respect test.pl's PERL5OPT setting but control the ordering of our own opts.
  my @perl5opt = split ' ', $ENV{PERL5OPT} || "";
  local $ENV{PERL5OPT};

  open(my $pipe, '-|',
    $^X, @perl5opt, "-Mlib=$ourlib", @_,
    "-MApp::RecordStream::Site",
    "-e", 'App::RecordStream::Site::bootstrap()')
      or die "open pipe failed: $!";
  local $/;
  return scalar <$pipe>;
}

done_testing;
