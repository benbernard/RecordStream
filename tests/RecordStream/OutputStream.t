use Test::More qw(no_plan);
use IO::String;
use Data::Dumper;

BEGIN { use_ok( 'App::RecordStream::OutputStream' ) };

use IO::String;
use App::RecordStream::Record;
use App::RecordStream::InputStream;

my $rec = App::RecordStream::Record->new(
   'foo' => 'bar',
   'zoo' => {
      'blah' => 'biz',
      'far'  => [ 'fing', 'fang', 'foom' ],
   }
);

my $output_string = App::RecordStream::OutputStream::hashref_string($rec);
my $in = App::RecordStream::InputStream->new(STRING => $output_string);
is_deeply($in->get_record(), $rec, 'got the same thing out as was put in');
