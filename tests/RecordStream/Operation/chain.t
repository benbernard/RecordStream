use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::chain' ) };

my $test_file = $ENV{'BASE_TEST_DIR'} . '/files/testFile';

my $solution = <<SOLUTION;
Chain Starts with:
  Recs command: recs-xform \$r->rename("foo", "zoo"); $test_file
  Passed in memory to Recs command: recs-sort --key zoo=-n
  Passed in memory to Recs command: recs-totable
  Passed in memory to Recs command: recs-grep
    Passed through a pipe to Shell command: bar
SOLUTION

my $keeper = App::RecordStream::Test::OperationHelper::Keeper->new();
my $op = App::RecordStream::Operation::chain->new([ '--n', 'recs-xform', '$r->rename("foo", "zoo");', $test_file, qw(| recs-sort --key zoo=-n  | recs-totable | recs-grep | bar) ], $keeper);

ok($op, "Chain initialized");

$op->finish();

is(join('', map { "$_\n" } @{$keeper->get_lines()}), $solution, "Output matches expectation");

# I'm not sure how to best test this, other than going at it... The forking makes it very complicated to test this in memory.
my $bin_dir = $ENV{'BASE_TEST_DIR'} . '/../bin';
my $base_dir = $ENV{'BASE_TEST_DIR'} . '/..';
open(my $outputfh, '-|', "$bin_dir/recs-chain  recs-xform '\$r->rename(\"foo\", \"zoo\");' $test_file \\| recs-sort --key zoo=-n \\| grep 3  \\| recs-totable");

my $expected = <<OUTPUT;
zoo
---
3  
OUTPUT


$/ = undef;
my $results = <$outputfh>;
is_deeply($results, $expected, "Complex chain matched output");

my $solution2 = <<SOLUTION2;
zoo
---
11 
10 
9  
8  
8  
6  
5  
4  
3  
2  
1  
SOLUTION2

# Again, not sure of the best testing strategy, since the chain would have to
# pass along the printer for the operations... Perhaps printers should be
# universal instead of relative to the object?
open(my $outputfh2, '-|', "$bin_dir/recs-chain  recs-xform '\$r->rename(\"foo\", \"zoo\");' $test_file \\| recs-sort --key zoo=-n \\| recs-totable");
$/ = undef;
my $results2 = <$outputfh2>;
is_deeply($results2, $solution2, "Complex chain matched output");
