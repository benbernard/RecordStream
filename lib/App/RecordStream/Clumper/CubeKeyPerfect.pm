package App::RecordStream::Clumper::CubeKeyPerfect;

use strict;
use warnings;

use App::RecordStream::Clumper::KeyPerfect;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Clumper::KeyPerfect';

sub long_usage
{
  return <<EOF;
Usage: cubekeyperfect,<keyspec>
   Clump records by a key and additionally produce an "ALL" slice.
EOF
}

sub short_usage
{
  return "clump records by a key";
}

sub get_values
{
  my $this = shift;
  my $value = shift;

  return ($value, "ALL");
}

App::RecordStream::Clumper->register_implementation('cubekeyperfect', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'cubekeyperfect', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'cubekey', 'VALUATION');

1;
