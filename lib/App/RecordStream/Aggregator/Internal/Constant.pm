package App::RecordStream::Aggregator::Internal::Constant;

use strict;
use warnings;

use App::RecordStream::Aggregator::Aggregation;
use base 'App::RecordStream::Aggregator::Aggregation';

sub new
{
    my $class = shift;
    my $value = shift;

    my $this =
    {
        'VALUE' => $value,
    };

    bless $this, $class;

    return $this;
}

sub initial
{
    return undef;
}

sub combine
{
    return undef;
}

sub squish
{
    my $this = shift;

    return $this->{'VALUE'};
}

1;
