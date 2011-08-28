use Test::More 'no_plan';
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromatomfeed' ) };

my $output1 = <<OUTPUT;
{"dc:creator":"author1","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry1","author":{"name":"author1"},"title":"Entry 1"}
OUTPUT

my $output2 = <<OUTPUT;
{"dc:creator":"author1","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry1","author":{"name":"author1"},"title":"Entry 1"}
{"dc:creator":"author2","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry2","author":{"name":"author2"},"title":"Entry 2"}
OUTPUT

my $output3 = <<OUTPUT;
{"dc:creator":"author1","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry1","author":{"name":"author1"},"title":"Entry 1"}
{"dc:creator":"author2","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry2","author":{"name":"author2"},"title":"Entry 2"}
{"dc:creator":"author3","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry1","author":{"name":"author3"},"title":"Entry 3"}
OUTPUT

my $output4 = <<OUTPUT;
{"dc:creator":"author1","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry1","author":{"name":"author1"},"title":"Entry 1"}
{"dc:creator":"author2","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry2","author":{"name":"author2"},"title":"Entry 2"}
{"dc:creator":"author3","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry1","author":{"name":"author3"},"title":"Entry 3"}
{"dc:creator":"author4","updated":"2007-06-06T07:00:00Z","id":"http://localhost/entry4","author":{"name":"author4"},"title":"Entry 4"}
OUTPUT

my $tester = App::RecordStream::Test::Tester->new('fromatomfeed');
$tester->no_input_test([                            'file:tests/files/testFeed1'], $output4);
$tester->no_input_test([              '--nofollow', 'file:tests/files/testFeed1'], $output2);
$tester->no_input_test(['--max', '1',               'file:tests/files/testFeed1'], $output1);
$tester->no_input_test(['--max', '1', '--nofollow', 'file:tests/files/testFeed1'], $output1);
$tester->no_input_test(['--max', '2',               'file:tests/files/testFeed1'], $output2);
$tester->no_input_test(['--max', '3',               'file:tests/files/testFeed1'], $output3);
$tester->no_input_test(['--max', '3', '--nofollow', 'file:tests/files/testFeed1'], $output2);
