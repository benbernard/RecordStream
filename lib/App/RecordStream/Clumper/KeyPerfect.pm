package App::RecordStream::Clumper::KeyPerfect;

use strict;
use warnings;

use App::RecordStream::Clumper::Key;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Clumper::Key';

sub long_usage
{
  return <<EOF;
Usage: keyperfect,<keyspec>
   Clump records by the value for a key
EOF
}

sub short_usage
{
  return "clump records by the value for a key";
}

sub key_clumper_begin
{
  return {};
}

sub key_clumper_push_record
{
  my $this = shift;
  my $cookie = shift;
  my $value = shift;
  my $record = shift;
  my $next = shift;

  for my $value ($this->get_values($value))
  {
    my $next_cookie = $cookie->{$value};
    if(!defined($next_cookie))
    {
      $next_cookie = $cookie->{$value} = $next->key_clumper_callback_begin_value($value);
    }

    $next->key_clumper_callback_push_record($next_cookie, $record);
  }
}

sub get_values
{
  my $this = shift;
  my $value = shift;

  return ($value);
}

sub key_clumper_end
{
  my $this = shift;
  my $cookie = shift;
  my $next = shift;

  for my $next_cookie (values(%$cookie))
  {
    $next->key_clumper_callback_end($next_cookie);
  }
}

App::RecordStream::Clumper->register_implementation('keyperfect', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'keyperfect', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'key', 'VALUATION');

1;
