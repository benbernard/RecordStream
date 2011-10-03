package App::RecordStream::Aggregator;

our $VERSION = "3.4";

use App::RecordStream::Site;

use strict;
use warnings;

sub load_aggregators
{
   for my $inc (@INC)
   {
      load_aggregators_aux($inc . "/App/RecordStream/Aggregator", "App/RecordStream/Aggregator");
   }

   # Now load aggregators from sites, overriding lower priority with higher priority
   App::RecordStream::Site::bootstrap();
   my @sites = sort { $a->{'priority'} <=> $b->{'priority'} } App::RecordStream::Site::list_sites();
   for my $site (@sites)
   {
      for my $inc (@INC)
      {
         my $rel = $site->{'path'} . "::Aggregator";
         $rel =~ s!::!\/!g;
         my $root = "$inc/$rel";
         load_aggregators_aux($root, $rel);
      }
   }
}

sub load_aggregators_aux
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

         load_aggregators_aux($root . "/" . $ent, $rel . "/" . $ent);
      }
   }
}

{
   my %registry;

   sub register_aggregator
   {
      my ($name, $class) = @_;

      $registry{$name} = $class;
   }

   sub make_aggregators
   {
      my (@specs) = @_;

      my %ret;

      for my $spec (@specs)
      {
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
            die "Bad aggregator spec: " . $spec . "\n";
         }

         my $aggr_name = shift(@spec);
         my $class = $registry{$aggr_name};
         if(!$class)
         {
            die "Bad aggregator: " . $aggr_name . "\n";
         }

         if(@spec != $class->argct())
         {
            $class->long_usage();
            die "Aggregator " . $class . " long_usage implementation returns?!\n";
         }

         $ret{$name} = $class->new(@spec);
      }

      return \%ret;
   }

   sub list_aggregators
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
      #exit 1;
   }

   sub show_aggregator
   {
      my ($aggr_name) = @_;

      my $class = $registry{$aggr_name};
      if(!$class)
      {
         print "Bad aggregator: " . $aggr_name . "\n";
         exit 1;
      }

      $class->long_usage();
      print "Aggregator " . $class . " long_usage implementation returns?!\n";
      exit 1;
   }
}

sub map_initial
{
   my ($aggrs) = @_;

   my %ret;
   for my $name (keys(%$aggrs))
   {
      $ret{$name} = $aggrs->{$name}->initial();
   }

   return \%ret;
}

sub map_combine
{
   my ($aggrs, $cookies, $record) = @_;

   my %ret;
   for my $name (keys(%$aggrs))
   {
      $ret{$name} = $aggrs->{$name}->combine($cookies->{$name}, $record);
   }

   return \%ret;
}

sub map_squish
{
   my ($aggrs, $cookies) = @_;

   my $return_record = App::RecordStream::Record->new();
   for my $name (keys(%$aggrs))
   {
      my $aggregator = $aggrs->{$name};
      my $value = $aggregator->squish($cookies->{$name});
      if ( $aggregator->returns_record() )
      {
         foreach my $key ( keys %$value )
         {
            ${$return_record->guess_key_from_spec("$name\_$key")} = $value->{$key};
         }
      }
      else
      {
         ${$return_record->guess_key_from_spec($name)} = $value;
      }
   }

   return $return_record;
}

1;
