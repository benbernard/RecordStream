use strict;
use warnings;

package App::RecordStream::Test::Aggregator::ArrayHelper;
use App::RecordStream::Record;
use Test::More ();
use base 'Exporter';

our @EXPORT = qw< array_agg_ok >;

sub array_agg_ok {
    my ($aggr, $input, $expected, $desc) = @_;

    $aggr = "App::RecordStream::Aggregator::$aggr"->new("x")
        unless ref $aggr;

    my $cookie = $aggr->initial();
    $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $_))
        for @$input;

    local $Test::Builder::Level = $Test::Builder::Level + 1;

    Test::More::is_deeply($aggr->squish($cookie), $expected, $desc);
}
