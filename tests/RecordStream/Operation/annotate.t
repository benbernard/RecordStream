use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::annotate' ) };

my $input = <<INPUT;
{"zip":["baz"],"foo":{"bar":1},"priority":0,"count":4,"state":"sleep","sum_rss":471040}
{"zip":["baz"],"foo":{"bar":1},"priority":19,"count":1,"state":"sleep","sum_rss":0}
{"zip":["baz"],"foo":{"bar":1},"priority":0,"count":5,"state":"ALL","sum_rss":5255168}
{"zip":["baz"],"foo":{"bar":1},"priority":0,"count":1,"state":"run","sum_rss":4784128}
{"zip":["baz"],"foo":{"bar":1},"priority":19,"count":3,"state":"ALL","sum_rss":8757248}
{"zip":["baz"],"foo":{"bar":1},"priority":19,"count":2,"state":"run","sum_rss":8757248}
INPUT

my $xform;
my $output;

$xform = App::RecordStream::Operation::annotate->new([qw(--keys priority), '{{zap}} = bar']),
$output = <<OUTPUT;
{"zap":"bar","zip":["baz"],"foo":{"bar":1},"priority":0,"count":4,"state":"sleep","sum_rss":471040}
{"zap":"bar","zip":["baz"],"foo":{"bar":1},"priority":19,"count":1,"state":"sleep","sum_rss":0}
{"zap":"bar","zip":["baz"],"foo":{"bar":1},"priority":0,"count":5,"state":"ALL","sum_rss":5255168}
{"zap":"bar","zip":["baz"],"foo":{"bar":1},"priority":0,"count":1,"state":"run","sum_rss":4784128}
{"zap":"bar","zip":["baz"],"foo":{"bar":1},"priority":19,"count":3,"state":"ALL","sum_rss":8757248}
{"zap":"bar","zip":["baz"],"foo":{"bar":1},"priority":19,"count":2,"state":"run","sum_rss":8757248}
OUTPUT

App::RecordStream::Test::OperationHelper->new(
   "operation" => $xform,
   "input"     => $input,
   "output"    => $output
)->matches();

$xform = App::RecordStream::Operation::annotate->new([qw(--keys priority), 'push @{ {{zip}} }, qw(bar biz)']),
$output = <<OUTPUT;
{"zip":["baz","bar","biz"],"foo":{"bar":1},"priority":0,"count":4,"state":"sleep","sum_rss":471040}
{"zip":["baz","bar","biz"],"foo":{"bar":1},"priority":19,"count":1,"state":"sleep","sum_rss":0}
{"zip":["baz","bar","biz"],"foo":{"bar":1},"priority":0,"count":5,"state":"ALL","sum_rss":5255168}
{"zip":["baz","bar","biz"],"foo":{"bar":1},"priority":0,"count":1,"state":"run","sum_rss":4784128}
{"zip":["baz","bar","biz"],"foo":{"bar":1},"priority":19,"count":3,"state":"ALL","sum_rss":8757248}
{"zip":["baz","bar","biz"],"foo":{"bar":1},"priority":19,"count":2,"state":"run","sum_rss":8757248}
OUTPUT

App::RecordStream::Test::OperationHelper->new(
   "operation" => $xform,
   "input"     => $input,
   "output"    => $output
)->matches();

$xform = App::RecordStream::Operation::annotate->new([qw(--keys priority), '{{zip/#0}} = "bar"']),
$output = <<OUTPUT;
{"zip":["bar"],"foo":{"bar":1},"priority":0,"count":4,"state":"sleep","sum_rss":471040}
{"zip":["bar"],"foo":{"bar":1},"priority":19,"count":1,"state":"sleep","sum_rss":0}
{"zip":["bar"],"foo":{"bar":1},"priority":0,"count":5,"state":"ALL","sum_rss":5255168}
{"zip":["bar"],"foo":{"bar":1},"priority":0,"count":1,"state":"run","sum_rss":4784128}
{"zip":["bar"],"foo":{"bar":1},"priority":19,"count":3,"state":"ALL","sum_rss":8757248}
{"zip":["bar"],"foo":{"bar":1},"priority":19,"count":2,"state":"run","sum_rss":8757248}
OUTPUT

App::RecordStream::Test::OperationHelper->new(
   "operation" => $xform,
   "input"     => $input,
   "output"    => $output
)->matches();

$xform = App::RecordStream::Operation::annotate->new([qw(--keys priority), '{{foo/biz}} = "bar"']),
$output = <<OUTPUT;
{"zip":["baz"],"foo":{"bar":1,"biz":"bar"},"priority":0,"count":4,"state":"sleep","sum_rss":471040}
{"zip":["baz"],"foo":{"bar":1,"biz":"bar"},"priority":19,"count":1,"state":"sleep","sum_rss":0}
{"zip":["baz"],"foo":{"bar":1,"biz":"bar"},"priority":0,"count":5,"state":"ALL","sum_rss":5255168}
{"zip":["baz"],"foo":{"bar":1,"biz":"bar"},"priority":0,"count":1,"state":"run","sum_rss":4784128}
{"zip":["baz"],"foo":{"bar":1,"biz":"bar"},"priority":19,"count":3,"state":"ALL","sum_rss":8757248}
{"zip":["baz"],"foo":{"bar":1,"biz":"bar"},"priority":19,"count":2,"state":"run","sum_rss":8757248}
OUTPUT

App::RecordStream::Test::OperationHelper->new(
   "operation" => $xform,
   "input"     => $input,
   "output"    => $output
)->matches();

