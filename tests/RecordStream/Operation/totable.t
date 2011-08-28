use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::totable' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
foo   zoo 
---   ----
1     biz1
2     biz2
3     biz3
4     biz4
5     biz5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'totable',
   [],
   $stream,
   $solution,
);

App::RecordStream::Test::OperationHelper->test_output(
   'totable',
   ['--key', '!oo!'],
   $stream,
   $solution,
);

my $solution2 = <<SOLUTION;
1   biz1
2   biz2
3   biz3
4   biz4
5   biz5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'totable',
   [qw(--no-header)],
   $stream,
   $solution2,
);

my $solution3 = <<SOLUTION;
foo
---
1  
2  
3  
4  
5  
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'totable',
   [qw(--k !foo!)],
   $stream,
   $solution3,
);

my $solution4 = <<SOLUTION;
foo	zoo
1	biz1
2	biz2
3	biz3
4	biz4
5	biz5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'totable',
   [qw(--spreadsheet)],
   $stream,
   $solution4,
);

my $solution5 = <<SOLUTION;
footzoo
1tbiz1
2tbiz2
3tbiz3
4tbiz4
5tbiz5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'totable',
   [qw(--spreadsheet --delim t)],
   $stream,
   $solution5,
);

