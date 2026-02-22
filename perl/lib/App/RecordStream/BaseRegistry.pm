package App::RecordStream::BaseRegistry;

use App::RecordStream::Site;

use strict;
use warnings;
use Module::Pluggable::Object;

sub load_implementations
{
  my $registry_class = shift;

  my $subtree = $registry_class->subtree();

  # include sites, overriding lower priority with higher priority
  App::RecordStream::Site::bootstrap();
  my @sites = sort { $a->{'priority'} <=> $b->{'priority'} } App::RecordStream::Site::list_sites();

  Module::Pluggable::Object->new(
    require     => 1,
    search_path => [
      "App::RecordStream::$subtree",
      map { "$_->{path}::$subtree" } @sites
    ],
  )->plugins;
}

{
  my %class_registry;

  sub register_implementation
  {
    my $registry_class = shift;
    my $name = shift;
    my $class = shift;

    $class_registry{$registry_class}->{$name} = $class;
  }

  sub parse_single_nameless_implementation
  {
    my $registry_class = shift;
    my $spec = shift;

    my @spec = split(/,/, $spec);

    if(!@spec)
    {
      die "Bad " . $registry_class->typename() . " spec: " . $spec . "\n";
    }

    my $aggr_name = shift(@spec);
    my $class = $class_registry{$registry_class}->{$aggr_name};
    if(!$class)
    {
      die "Bad " . $registry_class->typename() . ": " . $aggr_name . "\n";
    }

    my $argct = $class->argct();
    if(!ref($argct))
    {
      $argct = [$argct];
    }
    if(!(grep { $_ == @spec } @$argct))
    {
      print $class->long_usage();
      exit 1;
    }

    return $class->new(@spec);
  }

  sub list_implementations
  {
    my $registry_class = shift;
    my $prefix = shift || '';

    my %reverse;
    my @classes;
    for my $name (sort(keys(%{$class_registry{$registry_class}})))
    {
      my $class = $class_registry{$registry_class}->{$name};
      my $ar = $reverse{$class};
      if(!$ar)
      {
        $reverse{$class} = $ar = [];
        push @classes, $class;
      }
      push @$ar, $name;
    }
    my $ret = "";
    for my $class (@classes)
    {
      my $usage = $class->short_usage();
      $ret .= $prefix . join(", ", @{$reverse{$class}}) . ": " . $usage . "\n";
    }
    return $ret;
  }

  sub show_implementation
  {
    my $registry_class = shift;
    my $name = shift;

    my $class = $class_registry{$registry_class}->{$name};
    if(!$class)
    {
      print "Bad " . $registry_class->typename() . ": " . $name . "\n";
      exit 1;
    }

    print $class->long_usage();
  }
}

# subclasses may override these all if they wish

sub subtree
{
  my $registry_class = shift;

  return $registry_class->begin_sentence_typename();
}

sub begin_sentence_typename
{
  my $registry_class = shift;

  my $t = $registry_class->typename();

  return uc(substr($t, 0, 1)) . substr($t, 1);
}

sub typename
{
  my $registry_class = shift;

  die "BaseRegistry subclass $registry_class did not implement typename()";
}

1;
