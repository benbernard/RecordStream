package App::RecordStream::Site;

our $VERSION = "4.0.21";

use strict;
use warnings;

use Carp qw(croak);

{
  my $bootstrapped;
  my %registry;

  sub bootstrap
  {
    if($bootstrapped)
    {
      return;
    }

    my @site_libs = (
      (defined $ENV{RECS_SITELIB} ? $ENV{RECS_SITELIB} : ()),
      (defined $ENV{HOME} ? "$ENV{HOME}/.recs/site" : ()),
      map { "$_/Recs/Site" } @INC
    );

    # First we find all conceivable sites by looking for module files
    my %sites;
    for my $dir (@site_libs)
    {
      if(opendir(DIR, $dir))
      {
        while(my $site_module = readdir(DIR))
        {
          next if($site_module eq "." || $site_module eq "..");

          if($site_module =~ /^(.*)\.pm$/)
          {
            $sites{$1} = "$dir/$site_module";
          }
        }
        closedir(DIR);
      }
    }

    delete $sites{'Bootstrap'};

    # Then we try loading each of them (they register themselves)
    for my $site (sort(keys(%sites)))
    {
      require $sites{$site};
    }

    $bootstrapped = 1;
  }

  sub register_site
  {
    my ($class, %args) = @_;

    my $name     = delete($args{'name'})     || croak "No name given in registration?!\n";
    my $priority = delete($args{'priority'}) || 0;
    my $path     = delete($args{'path'})     || "App::RecordStream::Site::$name";

    $registry{$name} =
    {
      'name'     => $name,
      'path'     => $path,
      'priority' => $priority,
    };
  }

  sub list_sites
  {
    return values(%registry);
  }
}

1;
