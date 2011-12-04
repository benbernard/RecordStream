package App::RecordStream::BaseRegistry;

use App::RecordStream::Site;

use strict;
use lib;

sub load_implementations
{
  my $registry_class = shift;

  my $subtree = $registry_class->subtree();

  for my $inc (@INC)
  {
    load_implementations_aux($inc . "/App/RecordStream/$subtree", "App/RecordStream/$subtree");
  }

  # Now load from sites, overriding lower priority with higher priority
  App::RecordStream::Site::bootstrap();
  my @sites = sort { $a->{'priority'} <=> $b->{'priority'} } App::RecordStream::Site::list_sites();
  for my $site (@sites)
  {
    for my $inc (@INC)
    {
      my $rel = $site->{'path'} . "::$subtree";
      $rel =~ s!::!\/!g;
      my $root = "$inc/$rel";
      load_implementations_aux($root, $rel);
    }
  }
}

sub load_implementations_aux
{
  my ($root, $rel) = @_;

  if(opendir(DIR, $root))
  {
    my @ents = readdir(DIR);
    closedir(DIR);
    for my $ent (@ents)
    {
      if($ent eq "." || $ent eq "..")
      {
        next;
      }

      if($ent =~ /\.pm$/)
      {
        require $rel . "/" . $ent;
        next;
      }

      load_implementations_aux($root . "/" . $ent, $rel . "/" . $ent);
    }
  }
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
    for my $class (@classes)
    {
      my $usage = $class->short_usage();
      print join(", ", @{$reverse{$class}}) . ": " . $usage . "\n";
    }
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
