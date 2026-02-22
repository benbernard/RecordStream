use Test::More;
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromcsv' ) };

my $tester = App::RecordStream::Test::Tester->new('fromcsv');

my $input;
my $output;
my $error;

$input = <<INPUT;
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"baz"}
{"1":"bar loo","0":"foo loo","2":"baz"}
OUTPUT
$tester->test_stdin([], $input, $output);

$input = <<INPUT;
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"baz"}
{"1":"bar loo","0":"foo loo","2":" baz"}
OUTPUT
$tester->test_stdin(['--strict'], $input, $output);

$input = <<INPUT;
one,two,three
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"two":"bar","one":"foo","three":"baz"}
{"two":"bar loo","one":"foo loo","three":"baz"}
OUTPUT
$tester->test_stdin(['--header'], $input, $output);

$input = <<INPUT;
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"zip":["foo", "bar", "baz"]}
{"zip":["foo loo","bar loo","baz"]}
OUTPUT
$tester->test_stdin(['--key', 'zip/#0,zip/#1,zip/#2'], $input, $output);

SKIP: {
  skip "Text::CSV_PP doesn't currently handle embedded newlines + allow_loose_quotes (i.e. recs-fromcsv without --strict option)" => 1
    unless $INC{'Text/CSV_XS.pm'};

  $input = <<INPUT;
foo,bar,baz
"foo
loo","bar loo", baz
INPUT
  $output = <<OUTPUT;
{"zip":["foo", "bar", "baz"]}
{"zip":["foo\\nloo","bar loo","baz"]}
OUTPUT
  $tester->test_stdin(['--key', 'zip/#0,zip/#1,zip/#2'], $input, $output);
}

$input = <<INPUT;
foo;bar;baz
"foo loo";"bar loo"; baz
INPUT
$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"baz"}
{"1":"bar loo","0":"foo loo","2":"baz"}
OUTPUT
$tester->test_stdin(['--delim', ';'], $input, $output);

$output = <<OUTPUT;
{"static":42,"foo":"bar","baz":"bat"}
{"static":42,"red":"green","yellow":"blue"}
OUTPUT

App::RecordStream::Test::OperationHelper->do_match(
  'fromcsv',
  ['--header', '--key', 'static', 'tests/files/data3.csv', 'tests/files/data4.csv'],
  '',
  $output,
);

# Test that we error on parse fail in middle of file
$input = <<INPUT;
foo "bar" bat
baz
INPUT

ok !eval {
  $tester->test_stdin(['--strict'], $input, ''); 1;
  1;
}, "Parsing bad input makes operation fail";
$error = $@;
like $error, qr/^fromcsv: parse error:/, "Parsing bad input produces error";
like $error, qr/position \d, line 1, file NONE/, "Error contains position info"; # Text::CSV backends differ in ability to report character position

# Test that we error on parse fail on last line
$input = <<INPUT;
baz
foo "bar" bat
INPUT

ok !eval {
  $tester->test_stdin(['--strict'], $input, ''); 1;
  1;
}, "Parsing bad input makes operation fail";
$error = $@;
like $error, qr/^fromcsv: parse error:/, "Parsing bad input produces error";
like $error, qr/position \d, line 2, file NONE/, "Error contains position info"; # Text::CSV backends differ in ability to report character position

# Custom escape character
$input = <<INPUT;
"foo \\"bar\\" bat"
INPUT

$output = <<OUTPUT;
{"0":"foo \\"bar\\" bat"}
OUTPUT

$tester->test_stdin(['--strict', '--escape', '\\'], $input, $output);

done_testing;
