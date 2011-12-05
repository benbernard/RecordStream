package App::RecordStream::Clumper::KeyLRU;

use strict;
use warnings;

use App::RecordStream::Clumper::Key;
use App::RecordStream::DomainLanguage::Registry;
use App::RecordStream::LRUSheriff;

use base 'App::RecordStream::Clumper::Key';

sub new
{
  my $class = shift;
  my $field = shift;
  my $size = shift;

  my $this = $class->SUPER::new($field);

  $this->{'size'} = $size;

  return $this;
}

sub new_from_valuation
{
  my $class = shift;
  my $name = shift;
  my $valuation = shift;
  my $size = shift;

  my $this = $class->SUPER::new_from_valuation($name, $valuation);

  $this->{'size'} = $size;

  return $this;
}

sub long_usage
{
  return <<EOF;
Usage: keylru,<keyspec>,<size>
   Clump records by the value for a key, limiting number of active clumps to <size>
EOF
}

sub short_usage
{
  return "clump records by the value for a key, limiting number of active clumps";
}

sub argct
{
  return 2;
}

sub key_clumper_begin
{
  return App::RecordStream::LRUSheriff->new();
}

sub key_clumper_push_record
{
  my $this = shift;
  my $cookie = shift;
  my $value = shift;
  my $record = shift;
  my $next = shift;

  {
    my $next_cookie = $cookie->find($value);
    if(!defined($next_cookie))
    {
      $cookie->put($value, $next_cookie = $next->key_clumper_callback_begin());
    }

    $next->key_clumper_callback_push_record($next_cookie, $record);
  }

  for my $next_cookie ($cookie->purgenate($this->{'size'}))
  {
    $next->key_clumper_callback_end($next_cookie);
  }
}

sub key_clumper_end
{
  my $this = shift;
  my $cookie = shift;
  my $next = shift;

  for my $next_cookie ($cookie->purgenate(0))
  {
    $next->key_clumper_callback_end($next_cookie);
  }
}

App::RecordStream::Clumper->register_implementation('keylru', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'keylru', 'SCALAR', 'VALUATION', 'SCALAR');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'key', 'SCALAR', 'VALUATION', 'SCALAR');

1;
