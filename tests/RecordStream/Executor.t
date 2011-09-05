use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Executor"); }

use App::RecordStream::Record;

{
   my $rec = App::RecordStream::Record->new("a" => "b", "c" => "d");
   my $executor = App::RecordStream::Executor->new('{{a}}');

   ok($executor, "Executor initialized");
   is($executor->execute_code($rec), "b", "Test special lookup");

   my $executor2 = App::RecordStream::Executor->new('{{a}} = 3 . $line');
   is($executor2->execute_code($rec), "31", "test special assign return");
   is($rec->{'a'}, "31", "test special assign");

   my $executor3 = App::RecordStream::Executor->new('$r->{foo} = "bar"');
   is($executor3->execute_code($rec), "bar", "test \$r assign return");
   is($rec->{'foo'}, "bar", "test \$r assign");

   my $rec2 = App::RecordStream::Record->new('0' => "zero");
   my $executor4 = App::RecordStream::Executor->new('{{0}}');
   is($executor4->execute_code($rec2), "zero", "test number only in special lookup");

   my $executor5 = App::RecordStream::Executor->new('$global += 2; $global');
   is($executor5->execute_code($rec), 2, "Test Global variables 1");
   is($executor5->execute_code($rec2), 4, "Test Global variables 4");
}

use App::RecordStream::Test::OperationHelper;

my $output = <<OUTPUT;
{"line":1,"foo":1,"zap":"blah1","fn":"tests/files/testFile2"}
{"line":2,"foo":2,"zap":"blah2","fn":"tests/files/testFile2"}
{"line":3,"foo":3,"zap":"blah3","fn":"tests/files/testFile2"}
{"line":4,"value":"10.0.0.101","foo":"bar","element":"address","fn":"tests/files/testFile3"}
{"line":5,"value":"10.0.1.101","foo":"bar3","element":"address","fn":"tests/files/testFile3"}
{"line":6,"value":"10.0.0.102","foo":"bar3","element":"address2","fn":"tests/files/testFile3"}
{"line":7,"value":"10.0.0.103","foo":"bar","element":"address2","fn":"tests/files/testFile3"}
{"line":8,"value":"10.0.1.103","foo":"bar","element":"address2","fn":"tests/files/testFile3"}
OUTPUT

# Probably shouldn't use xform here, but I need a full context to test
# $filename and line substition
use App::RecordStream::Operation::xform;
App::RecordStream::Test::OperationHelper->do_match(
  'xform',
  ['{{fn}} = $filename; {{line}} = $line;', 'tests/files/testFile2', 'tests/files/testFile3'],
  '',
  $output
);
