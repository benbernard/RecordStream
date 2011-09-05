use Test::More qw(no_plan);
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::generate' ) };

my $input;
my $output;

my $tester = App::RecordStream::Test::Tester->new('generate');

$input = <<INPUT;
{"title":"ernie"}
{"title":"bert"}
INPUT

$output = <<OUTPUT;
{"backpointer":{"title":"ernie"},"title2":"ernie"}
{"backpointer":{"title":"bert"},"title2":"bert"}
OUTPUT

$tester->test_stdin([qw(--keychain backpointer), q("echo '{\"title2\":\"$r->{title}\"}'")], $input, $output);

$output = <<OUTPUT;
{"title":"ernie"}
{"backpointer":{"title":"ernie"},"title2":"ernie"}
{"title":"bert"}
{"backpointer":{"title":"bert"},"title2":"bert"}
OUTPUT

$tester->test_stdin([qw(--passthrough --keychain backpointer), q("echo '{\"title2\":\"$r->{title}\"}'")], $input, $output);
