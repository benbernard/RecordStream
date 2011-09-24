package App::RecordStream::Deaggregator;

use App::RecordStream::Site;

use strict;
use lib;

sub load_deaggregators
{
   for my $inc (@INC)
   {
      load_deaggregators_aux($inc . "/App/RecordStream/Deaggregator", "App/RecordStream/Deaggregator");
   }

   # Now load deaggregators from sites, overriding lower priority with higher priority
   App::RecordStream::Site::bootstrap();
   my @sites = sort { $a->{'priority'} <=> $b->{'priority'} } App::RecordStream::Site::list_sites();
   for my $site (@sites)
   {
      for my $inc (@INC)
      {
         my $rel = $site->{'path'} . "::Deaggregator";
         $rel =~ s!::!\/!g;
         my $root = "$inc/$rel";
         load_deaggregators_aux($root, $rel);
      }
   }
}

sub load_deaggregators_aux
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

         load_deaggregators_aux($root . "/" . $ent, $rel . "/" . $ent);
      }
   }
}

{
   my %registry;

   sub register_deaggregator
   {
      my ($name, $class) = @_;

      $registry{$name} = $class;
   }

   sub make_deaggregator
   {
      my $spec = shift;

      my $name;
      if($spec =~ /^(.*)=(.*)$/)
      {
         $name = $1;
         $spec = $2;
      }

      my @spec = split(/,/, $spec);
      if(!defined($name))
      {
         $name = join("_", map { my $n = $_; $n =~ s!/!_!; $n } @spec);
      }

      if(!@spec)
      {
         die "Bad deaggregator spec: " . $spec . "\n";
      }

      my $aggr_name = shift(@spec);
      my $class = $registry{$aggr_name};
      if(!$class)
      {
         die "Bad deaggregator: " . $aggr_name . "\n";
      }

      my $argct = $class->argct();
      if(!ref($argct))
      {
          $argct = [$argct];
      }
      if(!(grep { $_ == @spec } @$argct))
      {
         $class->long_usage();
         die "Deaggregator " . $class . " long_usage implementation returns?!\n";
      }

      return $class->new(@spec);
   }

   sub list_deaggregators
   {
      my %reverse;
      my @classes;
      for my $name (sort(keys(%registry)))
      {
         my $class = $registry{$name};
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
      exit 1;
   }

   sub show_deaggregator
   {
      my ($deaggr_name) = @_;

      my $class = $registry{$deaggr_name};
      if(!$class)
      {
         print "Bad deaggregator: " . $deaggr_name . "\n";
         exit 1;
      }

      $class->long_usage();
      print "Deaggregator " . $class . " long_usage implementation returns?!\n";
      exit 1;
   }
}

1;
