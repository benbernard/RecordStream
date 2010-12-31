use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::fromsplit' ) };

my $input;
my $output;

$output = <<OUTPUT;
{"f1":"A1","1":"A2,2","2":"A3"}
{"f1":"B1","1":"B2","2":"B3,B4","3":"B5"}
OUTPUT

test1(['-f', 'f1', '-d', ' ', 'tests/files/splitfile'], $output);

$output = <<OUTPUT;
{"0":"A1 A2","1":"2 A3"}
{"0":"B1 B2 B3","1":"B4 B5"}
OUTPUT

test1([qw(tests/files/splitfile)], $output);

$output = <<OUTPUT;
{"A1 A2":"B1 B2 B3","2 A3":"B4 B5"}
OUTPUT

test1(['--header', qw(tests/files/splitfile)], $output);

$input = <<INPUT;
foo bar  baz
foo bar biz
INPUT
$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"","3":"baz"}
{"1":"bar","0":"foo","2":"biz"}
OUTPUT
test_inline_input(['--strict', '--delim', ' '], $input, $output);

$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"baz"}
{"1":"bar","0":"foo","2":"biz"}
OUTPUT
test_inline_input(['--delim', '\s+'], $input, $output);

sub test1 {
   my ($args, $output) = @_;

   Recs::Test::OperationHelper->do_match(
      'fromsplit',
      $args,
      undef,
      $output,
   );
}

sub test_inline_input {
   my ($args, $input, $output) = @_;

   open(STDIN, "-|", "echo", "-n", $input) || ok(0, "Cannot open echo?!");
   my $fromre = Recs::Operation::fromsplit->new($args);
   Recs::Test::OperationHelper->new("operation" => $fromre, "input" => undef, "output" => $output)->matches();
}
