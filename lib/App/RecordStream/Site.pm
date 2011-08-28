package App::RecordStream::Site;

our $VERSION = "3.4";

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

    # First we find all conceivable sites by looking for module files
    my %sites;
    for my $inc (@INC)
    {
      if(opendir(DIR, "$inc/Recs/Site"))
      {
        while(my $site_module = readdir(DIR))
        {
          next if($site_module eq "." || $site_module eq "..");

          if($site_module =~ /^(.*)\.pm$/)
          {
            $sites{$1} = 1;
          }
        }
        closedir(DIR);
      }
    }

    delete $sites{'Bootstrap'};

    # Then we try loading each of them (they register themselves)
    for my $site (sort(keys(%sites)))
    {
      require "Recs/Site/$site.pm";
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
