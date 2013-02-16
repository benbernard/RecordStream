package App::RecordStream::Stream::Base;

use JSON;

use App::RecordStream::Record;
use App::RecordStream::OutputStream;

my $json = new JSON;

sub new
{
  my $class = shift;

  my $this =
  {
  };

  bless $this, $class;

  return $this;
}

sub accept_record
{
  my $this = shift;
  my $record = shift;

  my $line = App::RecordStream::OutputStream::hashref_string($record);

  return $this->accept_line($line);
}

sub accept_line
{
  my $this = shift;
  my $line = shift;

  my $record = App::RecordStream::Record->new($json->decode($line));

  return $this->accept_record($record);
}

sub finish
{
}

1;
