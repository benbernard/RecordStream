package App::RecordStream::Stream::Sub;

use App::RecordStream::Stream::Base;

use base 'App::RecordStream::Stream::Base';

sub new
{
  my $class = shift;
  my $record_sub = shift;
  my $line_sub = shift;

  my $this = $class->SUPER::new();

  $this->{'RECORD_SUB'} = $record_sub;
  $this->{'LINE_SUB'} = $line_sub;

  bless $this, $class;

  return $this;
}

sub accept_record
{
  my $this = shift;
  my $record = shift;

  return $this->{'RECORD_SUB'}->($record);
}

sub accept_line
{
  my $this = shift;
  my $line = shift;

  return $this->{'LINE_SUB'}->($line);
}

1;
