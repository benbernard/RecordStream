use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Operation::xform"); }
BEGIN { use_ok("App::RecordStream::Operation::fromcsv"); }

use App::RecordStream::Record;
use App::RecordStream::Test::OperationHelper;

my $output = <<OUTPUT;
{"foo":1,"zap":"blah1","fn":"tests/files/testFile2"}
{"foo":2,"zap":"blah2","fn":"tests/files/testFile2"}
{"foo":3,"zap":"blah3","fn":"tests/files/testFile2"}
{"value":"10.0.0.101","foo":"bar","element":"address","fn":"tests/files/testFile3"}
{"value":"10.0.1.101","foo":"bar3","element":"address","fn":"tests/files/testFile3"}
{"value":"10.0.0.102","foo":"bar3","element":"address2","fn":"tests/files/testFile3"}
{"value":"10.0.0.103","foo":"bar","element":"address2","fn":"tests/files/testFile3"}
{"value":"10.0.1.103","foo":"bar","element":"address2","fn":"tests/files/testFile3"}
OUTPUT

# Probably shouldn't use xform here... unclear what to use
use App::RecordStream::Operation::xform;
App::RecordStream::Test::OperationHelper->do_match(
  'xform',
  ['$foo=""', 'tests/files/testFile2', 'tests/files/testFile3', '--filename-key', 'fn'],
  '',
  $output,
);

$output = <<OUTPUT;
{"1":"two","0":"one","2":"three","fn":"tests/files/data.csv"}
{"1":"bar","0":"foo","2":"baz","fn":"tests/files/data.csv"}
{"1":"bar loo","0":"foo\\nloo","2":"baz","fn":"tests/files/data.csv"}
{"1":"two","0":"one","2":"three","fn":"tests/files/data2.csv"}
{"1":"bar","0":"foo","2":"baz","fn":"tests/files/data2.csv"}
{"1":"bar loo","0":"foo\\nloo","2":"baz","fn":"tests/files/data2.csv"}
OUTPUT

use App::RecordStream::Operation::xform;
App::RecordStream::Test::OperationHelper->do_match(
  'fromcsv',
  ['tests/files/data.csv', 'tests/files/data2.csv', '--filename-key', 'fn'],
  '',
  $output,
);
