use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::generate' ) };

my $input;
my $output;

$input = <<INPUT;
{"title":"ernie"}
{"title":"bert"}
INPUT

$output = <<OUTPUT;
{"backpointer":{"title":"ernie"},"title2":"ernie"}
{"backpointer":{"title":"bert"},"title2":"bert"}
OUTPUT

test1([qw(--keychain backpointer), q(echo {\"title2\":\"$r->{title}\"})], $input, $output);

$output = <<OUTPUT;
{"title":"ernie"}
{"backpointer":{"title":"ernie"},"title2":"ernie"}
{"title":"bert"}
{"backpointer":{"title":"bert"},"title2":"bert"}
OUTPUT

test1([qw(--passthrough --keychain backpointer), q(echo {\"title2\":\"$r->{title}\"})], $input, $output);

sub test1
{
   my ($args, $input, $output) = @_;

   open(STDIN, "-|", "echo", "-n", $input) || ok(0, "Cannot open echo?!");
   my $fromre = Recs::Operation::generate->new($args);
   Recs::Test::OperationHelper->new("operation" => $fromre, "input" => undef, "output" => $output)->matches();
}
