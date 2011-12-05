package App::RecordStream::Clumper::Window;

use strict;
use warnings;

use App::RecordStream::Clumper::Base;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Clumper::Base';

sub new
{
  my $class = shift;
  my $size = shift;

  my $this =
  {
    'size' => $size,
  };
  bless $this, $class;

  return $this;
}

sub long_usage
{
  return <<EOF;
Usage: window,<size>
   Clump records by a rolling window of size <size>.  The windows are strict
   (that is partial windows are not given at the beginning or end).  For
   example, if there are five input records (1, 2, 3, 4, 5) and the window is
   3, then the first clump will be (1, 2, 3), the second (2, 3, 4) and the
   third and final (3, 4, 5).
EOF
}

sub short_usage
{
  return "clump records by a rolling window";
}

sub argct
{
  return 1;
}

sub clumper_begin
{
  my $this = shift;
  my $bucket = shift;

  return [$bucket, []];
}

sub clumper_push_record
{
  my $this = shift;
  my $cookie = shift;
  my $record = shift;
  my $next = shift;

  my $bucket = $cookie->[0];
  my $window = $cookie->[1];

  push @$window, $record;
  if(@$window > $this->{'size'})
  {
    shift @$window;
  }
  if(@$window >= $this->{'size'})
  {
    my $next_cookie = $next->clumper_callback_begin($bucket);
    for my $record (@$window)
    {
      $next->clumper_callback_push_record($next_cookie, $record);
    }
    $next->clumper_callback_end($next_cookie);
  }
}

sub clumper_end
{
  # ignore
}

App::RecordStream::Clumper->register_implementation('window', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new', 'window', 'SCALAR');

1;
