package App::RecordStream::Clumper::Key::WrappedCallback;

use strict;
use warnings;

sub new
{
  my $class = shift;
  my $next = shift;
  my $bucket = shift;
  my $name = shift;
  my $value = shift;

  my $this =
  {
    'next' => $next,
    'bucket' => $bucket,
    'name' => $name,
    'value' => $value,
  };
  bless $this, $class;

  return $this;
}

sub key_clumper_callback_begin
{
  my $this = shift;

  $this->key_clumper_callback_begin_value($this->{'value'});
}

sub key_clumper_callback_begin_value
{
  my $this = shift;
  my $value = shift;

  my $name = $this->{'name'};
  my $bucket = $this->{'bucket'};
  if(!defined($bucket))
  {
    die "clumper_callback_begin() called in bucketless position (did you call begin() in your end()?)";
  }

  return $this->{'next'}->clumper_callback_begin({%$bucket, $name => $value});
}

sub key_clumper_callback_push_record
{
  my $this = shift;
  my $cookie = shift;
  my $record = shift;

  $this->{'next'}->clumper_callback_push_record($cookie, $record);
}

sub key_clumper_callback_end
{
  my $this = shift;
  my $cookie = shift;

  $this->{'next'}->clumper_callback_end($cookie);
}

1;
