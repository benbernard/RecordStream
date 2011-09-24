package App::RecordStream::Aggregator::Internal::Ord2UnivariateMap;

use strict;
use warnings;

use App::RecordStream::Aggregator::Ord2Univariate;

use base 'App::RecordStream::Aggregator::Ord2Univariate';

#sub new -- passed through

#sub new_from_valuation -- passed through

sub squish
{
   my ($this, $cookie) = @_;

   my ($sum1, $sumx, $sumx2) = @$cookie;

   my $var = ($sumx2 / $sum1) - ($sumx / $sum1) ** 2;
   return
   {
       'ct' => $sum1,

       'sum' => $sumx,
       'avg' => $sumx / $sum1,

       'sum2' => $sumx2,
       'avg2' => $sumx2 / $sum1,
       'var' => $var,
       'stddev' => sqrt($var),
   };
}

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'ord2map', 'VALUATION');

1;
