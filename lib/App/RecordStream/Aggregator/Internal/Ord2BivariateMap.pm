package App::RecordStream::Aggregator::Internal::Ord2BivariateMap;

use strict;
use lib;

use App::RecordStream::Aggregator::Ord2Bivariate;

use base 'App::RecordStream::Aggregator::Ord2Bivariate';

#sub new -- passed through

#sub new_from_valuation -- passed through

sub squish
{
   my ($this, $cookie) = @_;

   my ($sum1, $sumx, $sumy, $sumxy, $sumx2, $sumy2) = @$cookie;

   my $corr = ($sumxy * $sum1 - $sumx * $sumy) / sqrt(($sumx2 * $sum1 - $sumx ** 2) * ($sumy2 * $sum1 - $sumy ** 2));
   my $cov = ($sumxy / $sum1) - ($sumx / $sum1) * ($sumy / $sum1);
   my $varx = ($sumx2 / $sum1) - ($sumx / $sum1) ** 2;
   my $vary = ($sumy2 / $sum1) - ($sumy / $sum1) ** 2;
   return
   {
       'ct' => $sum1,

       'sumx' => $sumx,
       'avgx' => $sumx / $sum1,

       'sumx2' => $sumx2,
       'avgx2' => $sumx2 / $sum1,
       'varx' => $varx,
       'stddevx' => sqrt($varx),

       'sumy' => $sumy,
       'avgy' => $sumy / $sum1,

       'sumy2' => $sumy2,
       'avgy2' => $sumy2 / $sum1,
       'vary' => $vary,
       'stddevy' => sqrt($vary),

       'sumxy' => $sumxy,
       'avgxy' => $sumxy / $sum1,
       'cov' => $cov,

       'corr' => $corr,
   };
}

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'ord2map', 'VALUATION', 'VALUATION');

1;
