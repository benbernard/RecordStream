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

   my $args = {
     assign_input => {
       code => '{{input}} = $input',
       arg_names => [qw(r input)],
     },
   };

   my $executor6 = App::RecordStream::Executor->new($args);
   is($executor6->execute_method('assign_input', $rec, 'bar'), 'bar', "Test named input");
   is($executor6->execute_method('assign_input', $rec2, 'foo'), 'foo', "Test named input2");
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

my $input = <<INPUT;
{"a":12,"b":1}
{"a":345,"b":2}
INPUT
$output = <<OUTPUT;
{"a":12,"b":1,"reduced":12,"sum":13}
{"a":345,"b":2,"reduced":690,"sum":347}
OUTPUT
# -M with import list
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-MList::Util=reduce,sum', '{{reduced}} = reduce { $a * $b } values %$r; {{sum}} = sum @{$r}{qw(a b)};'],
    $input,
    $output
);

# -m with imports is same as -M
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-mList::Util=reduce,sum', '{{reduced}} = reduce { $a * $b } values %$r; {{sum}} = sum @{$r}{qw(a b)};'],
    $input,
    $output
);

# -M with default exports
$output = <<OUTPUT;
{"a":"\$VAR1 = 12;"}
{"a":"\$VAR1 = 345;"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-MData::Dumper', '{{a}} = Dumper({{a}}); chomp {{a}}; delete $r->{b};'],
    $input,
    $output
);

# -m shouldn't import default exports
$output = <<OUTPUT;
{"a":"\$VAR1 = 12;","ok":"1"}
{"a":"\$VAR1 = 345;","ok":"1"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-mData::Dumper', '{{a}} = Data::Dumper::Dumper({{a}}); chomp {{a}}; delete $r->{b}; {{ok}} = not __PACKAGE__->can("Dumper");'],
    $input,
    $output
);
