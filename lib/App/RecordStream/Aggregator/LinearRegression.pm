package App::RecordStream::Aggregator::LinearRegression;

use strict;
use warnings;

use App::RecordStream::Aggregator::Ord2Bivariate;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::Ord2Bivariate';

#sub new -- passed through

#sub new_from_valuation -- passed through

sub squish
{
   my ($this, $cookie) = @_;

   my ($sum1, $sumx, $sumy, $sumxy, $sumx2, $sumy2) = @$cookie;

   my $beta = ($sumxy * $sum1 - $sumx * $sumy) / ($sumx2 * $sum1 - $sumx ** 2);
   my $alpha = ($sumy - $beta * $sumx) / $sum1;

   my $sbeta_numerator = ($sumy2 + $alpha ** 2 * $sum1 + $beta ** 2 * $sumx2 - 2 * $alpha * $sumy + 2 * $alpha * $beta * $sumx - 2 * $beta * $sumxy) / ($sum1 - 2);
   my $sbeta_denominator = $sumx2 - $sumx * $sumx / $sum1;
   my $sbeta = sqrt($sbeta_numerator / $sbeta_denominator);
   my $salpha = $sbeta * sqrt($sumx2 / $sum1);

   return
   {
      'alpha' => $alpha,
      'beta' => $beta,
      'beta_se' => $sbeta,
      'alpha_se' => $salpha,
   };
}

sub long_usage
{
   while(my $line = <DATA>)
   {
      print $line;
   }
   exit 1;
}

sub short_usage
{
   return "perform a linear regression of provided fields, dumping various statistics";
}

App::RecordStream::Aggregator::register_aggregator('linreg', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('linearregression', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'linreg', 'VALUATION', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'linearregression', 'VALUATION', 'VALUATION');

1;

__DATA__
Usage: linreg,<x field>,<y field>
   Dump various status from a linear regression of y against x.
