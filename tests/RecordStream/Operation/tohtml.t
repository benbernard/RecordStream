use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::tohtml' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
<table>
  <tr >
    <th >foo</th>
    <th >zoo</th>
  </tr>
  <tr >
    <td >1</td>
    <td >biz1</td>
  </tr>
  <tr >
    <td >2</td>
    <td >biz2</td>
  </tr>
  <tr >
    <td >3</td>
    <td >biz3</td>
  </tr>
  <tr >
    <td >4</td>
    <td >biz4</td>
  </tr>
  <tr >
    <td >5</td>
    <td >biz5</td>
  </tr>
</table>
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'tohtml',
   [],
   $stream,
   $solution,
);

# KeyGroup test
App::RecordStream::Test::OperationHelper->test_output(
   'tohtml',
   ['--key', '!.!'],
   $stream,
   $solution,
);

my $solution2 = <<SOLUTION;
<table>
  <tr >
    <th >foo</th>
  </tr>
  <tr >
    <td >1</td>
  </tr>
  <tr >
    <td >2</td>
  </tr>
  <tr >
    <td >3</td>
  </tr>
  <tr >
    <td >4</td>
  </tr>
  <tr >
    <td >5</td>
  </tr>
</table>
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'tohtml',
   [qw(--fields foo)],
   $stream,
   $solution2,
);

my $solution3 = <<SOLUTION;
<table>
  <tr >
    <td >1</td>
    <td >biz1</td>
  </tr>
  <tr >
    <td >2</td>
    <td >biz2</td>
  </tr>
  <tr >
    <td >3</td>
    <td >biz3</td>
  </tr>
  <tr >
    <td >4</td>
    <td >biz4</td>
  </tr>
  <tr >
    <td >5</td>
    <td >biz5</td>
  </tr>
</table>
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'tohtml',
   [qw(--noheader)],
   $stream,
   $solution3,
);

my $solution4 = <<SOLUTION;
<table>
  <tr bar=zap>
    <th biz=bam>foo</th>
    <th biz=bam>zoo</th>
  </tr>
  <tr bar=zap>
    <td biz=bam>1</td>
    <td biz=bam>biz1</td>
  </tr>
  <tr bar=zap>
    <td biz=bam>2</td>
    <td biz=bam>biz2</td>
  </tr>
  <tr bar=zap>
    <td biz=bam>3</td>
    <td biz=bam>biz3</td>
  </tr>
  <tr bar=zap>
    <td biz=bam>4</td>
    <td biz=bam>biz4</td>
  </tr>
  <tr bar=zap>
    <td biz=bam>5</td>
    <td biz=bam>biz5</td>
  </tr>
</table>
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'tohtml',
   [qw(--row bar=zap --cell biz=bam)],
   $stream,
   $solution4,
);
