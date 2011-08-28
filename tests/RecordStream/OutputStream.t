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

my $fh = IO::String->new();

ok(my $out = App::RecordStream::OutputStream->new($fh), 'Constructor test');
ok($out->put_record($rec), 'Put a record');

my $output_string = ${$fh->string_ref};
my $in = App::RecordStream::InputStream->new(STRING=> $output_string);
is_deeply($in->get_record(), $rec, 'got the same thing out as was put in');

#Remove printed newline
chomp $output_string;

is($output_string, $out->record_string($rec), "String output agrees with printed output");

my $hash = {
   'foo' => 'bar',
   'zoo' => {
      'blah' => 'biz',
      'far'  => [ 'fing', 'fang', 'foom' ],
   }
};

is($output_string, $out->hashref_string($hash), "String output (hashref) agrees with printed output");
