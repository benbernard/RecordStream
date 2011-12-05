package App::RecordStream::Clumper::Key;

use strict;
use warnings;

use App::RecordStream::Clumper::Key::WrappedCallback;
use App::RecordStream::Clumper;

use base 'App::RecordStream::Clumper';

sub new
{
  my $class = shift;
  my $field = shift;

  return new_from_valuation($class, $field, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($field));
}

sub new_from_valuation
{
  my $class = shift;
  my $name = shift;
  my $valuation = shift;

  my $this =
  {
    'name' => $name,
    'valuation' => $valuation,
  };
  bless $this, $class;

  return $this;
}

sub evaluate_record
{
  my $this = shift;
  my $record = shift;

  my $v = $this->{'valuation'}->evaluate_record($record);
  if(!defined($v))
  {
    $v = "";
  }

  return $v;
}

sub clumper_begin
{
  my $this = shift;
  my $bucket = shift;

  return [$bucket, $this->key_clumper_begin()];
}

sub clumper_push_record
{
  my $this = shift;
  my $cookie = shift;
  my $record = shift;
  my $next = shift;

  my $name = $this->{'name'};
  my $value = $this->evaluate_record($record);

  my $wrapped_next = App::RecordStream::Clumper::Key::WrappedCallback->new($next, $cookie->[0], $name, $value);

  $this->key_clumper_push_record($cookie->[1], $value, $record, $wrapped_next);
}

sub clumper_end
{
  my $this = shift;
  my $cookie = shift;
  my $next = shift;

  my $wrapped_next = App::RecordStream::Clumper::Key::WrappedCallback->new($next, undef);

  $this->key_clumper_end($cookie->[1], $wrapped_next);
}


sub argct
{
  return 1;
}

1;
