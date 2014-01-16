package App::RecordStream::Aggregator::Maximum;

our $VERSION = "3.7.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::InjectInto::Field;
use App::RecordStream::DomainLanguage::Registry;

use base qw(App::RecordStream::Aggregator::InjectInto::Field);

#sub new -- passed through

#sub new_from_valuation -- passed through

sub combine_field
{
  my $this   = shift;
  my $cookie = shift;
  my $value  = shift;

  return $value unless ( defined $cookie );

  if ( $cookie < $value )
  {
    return $value;
  }

  return $cookie;
}

sub short_usage
{
  return "maximum value for a field";
}

sub long_usage
{
  return <<EOF;
Usage: max,<field>
   Maximum value of specified field.
EOF
}

App::RecordStream::Aggregator->register_implementation('maximum', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('max', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'maximum', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'max', 'VALUATION');

1;
