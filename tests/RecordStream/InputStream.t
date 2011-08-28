use Test::More qw(no_plan);
use IO::String;
use Data::Dumper;

my $files_dir = $ENV{'BASE_TEST_DIR'} . '/files';

BEGIN { use_ok( 'App::RecordStream::InputStream' ) };

use App::RecordStream::Record;

my $hash = App::RecordStream::Record->new(
   'foo' => 'bar',
   'zoo' => {
      'blah' => 'biz',
      'far'  => [ 'fing', 'fang', 'foom' ],
   }
);

my $json = '{"foo":"bar","zoo":{"blah":"biz","far":["fing","fang","foom"]}}';

my $handle = IO::String->new($json);

ok(my $stream = App::RecordStream::InputStream->new(FH => $handle), 'Initialize');
my $record = $stream->get_record();

is(ref $record, 'App::RecordStream::Record', 'Returns Record Object');

is_deeply($record, $hash, 'Basic Input');
is_deeply($stream->get_record(), undef, 'Undef is the end of the stream');
ok($stream->is_done(), "Stream is_done");

ok(my $string_stream = App::RecordStream::InputStream->new(STRING => $json), "String Initialize");
is_deeply($string_stream->get_record(), $hash, 'String Basic Input');

my $multiple = "$json\n$json\n";

ok(my $multiple_stream = App::RecordStream::InputStream->new(STRING => $multiple), "Multple String Initialize");
is_deeply($multiple_stream->get_record(), $hash, 'Multiple string input');
is_deeply($multiple_stream->get_record(), $hash, 'Multiple string input');

my $file  = $files_dir . '/file1';
my $file2 = $files_dir . '/file2';

ok(my $file_stream = App::RecordStream::InputStream->new(FILE => $file), "File Initialize");
is_deeply($file_stream->get_record(), $hash, 'File input');
is_deeply($file_stream->get_record(), undef, 'File input Ends');

ok(my $chain_stream = App::RecordStream::InputStream->new_from_files([$file, $file2]), "Chained File Initialize");
is_deeply($chain_stream->get_record(), $hash, 'Chain input');
is_deeply($chain_stream->get_record(), $hash, 'Chain input');
is_deeply($chain_stream->get_record(), $hash, 'Chain input');
is_deeply($chain_stream->get_record(), undef, 'Chain input Ends');

my @old_argv = @ARGV;
@ARGV = ($file, $file2);
ok(my $magic_stream = App::RecordStream::InputStream->new_magic(), "Magic Initialize");
is_deeply($magic_stream->get_record(), $hash, 'Magic input');
is_deeply($magic_stream->get_record(), $hash, 'Magic input');
is_deeply($magic_stream->get_record(), $hash, 'Magic input');
is_deeply($magic_stream->get_record(), undef, 'Magic input Ends');
@ARGV = @old_argv;

my $empty_fh = IO::String->new('');
ok(my $empty_stream = App::RecordStream::InputStream->new(FH => $empty_fh), "Empty String Initialize");
is_deeply($empty_stream->get_record(), undef, 'Empty String stream ends');
