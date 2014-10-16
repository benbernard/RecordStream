package App::RecordStream::Deaggregator;

use strict;
use warnings;

use App::RecordStream::BaseRegistry;

use base ('App::RecordStream::BaseRegistry');

sub make_deaggregator
{
    my $registry_class = shift;
    my $spec = shift;

    return $registry_class->parse_single_nameless_implementation($spec);
}

sub typename
{
  return "deaggregator";
}

1;
