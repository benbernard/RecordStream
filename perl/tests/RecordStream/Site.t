use strict;
use warnings;
use Test::More;
use File::Basename qw< dirname >;
use File::Spec::Functions qw< catdir updir >;

# Protect against any unexpected user config when running tests.
undef $ENV{RECS_SITELIB};
undef $ENV{HOME};

my $testlib = catdir($ENV{BASE_TEST_DIR}, "lib");

# Defaults
{
  my $output = load_sites();
  unlike $output, qr/Recs::Site::INC/,        "not loaded INC.pm";
  unlike $output, qr/Recs::Site::EnvSiteLib/, "not loaded EnvSiteLib.pm";
  unlike $output, qr/Recs::Site::Home/,       "not loaded Home.pm";
}

# Defaults, local @INC
{
  my $output = load_sites("-Mlib=$testlib");
  like   $output, qr/Recs::Site::INC/,        "    loaded INC.pm";
  unlike $output, qr/Recs::Site::EnvSiteLib/, "not loaded EnvSiteLib.pm";
  unlike $output, qr/Recs::Site::Home/,       "not loaded Home.pm";
}

# RECS_SITELIB
{
  local $ENV{RECS_SITELIB} = $testlib;
  my $output = load_sites();
  unlike $output, qr/Recs::Site::INC/,        "not loaded INC.pm";
  like   $output, qr/Recs::Site::EnvSiteLib/, "    loaded EnvSiteLib.pm";
  unlike $output, qr/Recs::Site::Home/,       "not loaded Home.pm";
}

# HOME
{
  local $ENV{HOME} = catdir($ENV{BASE_TEST_DIR}, "files");
  my $output = load_sites();
  unlike $output, qr/Recs::Site::INC/,        "not loaded INC.pm";
  unlike $output, qr/Recs::Site::EnvSiteLib/, "not loaded EnvSiteLib.pm";
  like   $output, qr/Recs::Site::Home/,       "    loaded Home.pm";
}

# All together now!
{
  local $ENV{HOME} = catdir($ENV{BASE_TEST_DIR}, "files");
  local $ENV{RECS_SITELIB} = $testlib;
  my $output = load_sites("-Mlib=$testlib");
  like   $output, qr/Recs::Site::INC/,        "    loaded INC.pm";
  like   $output, qr/Recs::Site::EnvSiteLib/, "    loaded EnvSiteLib.pm";
  like   $output, qr/Recs::Site::Home/,       "    loaded Home.pm";
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
