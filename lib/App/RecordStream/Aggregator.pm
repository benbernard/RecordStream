package App::RecordStream::Aggregator;

our $VERSION = "4.0.24";

use strict;
use warnings;

use App::RecordStream::BaseRegistry;
use App::RecordStream::Site;

use base ('App::RecordStream::BaseRegistry');

sub make_aggregators
{
  my $registry_class = shift;

  my %ret;

  for my $input (@_)
  {
    my $spec = $input;
    my $name;

    if($spec =~ /^(.*)=(.*)$/)
    {
      $name = $1;
      $spec = $2;
    }

    if(!defined($name))
    {
      my @spec = split(/,/, $spec);
      $name = join("_", map { my $n = $_; $n =~ s!/!_!; $n } @spec);
    }

    $ret{$name} = $registry_class->parse_single_nameless_implementation($spec);
  }

  return \%ret;
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
    ${$return_record->guess_key_from_spec($name)} = $value;
  }

  return $return_record;
}

sub typename
{
  return "aggregator";
}

1;
