package App::RecordStream::Aggregator::First;

our $VERSION = "4.0.12";

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

  return defined($cookie) ? $cookie : $value;
}

sub short_usage
{
  return "first value for a field";
}

sub long_usage
{
  return <<EOF;
Usage: first,<field>
   First value of specified field.
EOF
}

App::RecordStream::Aggregator->register_implementation('first', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'first', 'VALUATION');

1;
