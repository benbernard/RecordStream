use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::fromxml' ) };

my $solution = <<SOLUTION;
{"value":"10.0.0.101","element":"address"}
{"value":"10.0.1.101","element":"address"}
{"value":"10.0.0.102","element":"address"}
{"value":"10.0.0.103","element":"address"}
{"value":"10.0.1.103","element":"address"}
{"value":"/var/log/foo/","element":"logdir"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'fromxml',
  [qw(--element logdir --element address --nested file:tests/files/xml1)],
  '',
  $solution,
);

my $solution2 = <<SOLUTION;
{"name":"sahara","osname":"solaris","inner":[{"foo":"bar","panda":["1.2.3.4"]}],"address":["10.0.0.101","10.0.1.101"],"osversion":"2.6"}
{"osversion":"6.5","name":"gobi","osname":"irix","address":["10.0.0.102"]}
{"name":"kalahari","osname":"linux","address":["10.0.0.103","10.0.1.103"],"osversion":"2.0.34"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'fromxml',
  [qw(--element server file:tests/files/xml1)],
  '',
  $solution2,
);

App::RecordStream::Test::OperationHelper->do_match(
  'fromxml',
  [qw(--element server --element server file:tests/files/xml1)],
  '',
  $solution2,
);

my $solution3 = <<SOLUTION;
{"osversion":"2.6","element":"server","address":["10.0.0.101","10.0.1.101"],"osname":"solaris","name":"sahara","inner":[{"foo":"bar","panda":["1.2.3.4"]}]}
{"address":["10.0.0.102"],"element":"server","osversion":"6.5","name":"gobi","osname":"irix"}
{"osname":"linux","name":"kalahari","element":"server","osversion":"2.0.34","address":["10.0.0.103","10.0.1.103"]}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'fromxml',
  [qw(--element server --element inner --nested file:tests/files/xml1)],
  '',
  $solution3,
);

{
  no warnings 'qw';
  App::RecordStream::Test::OperationHelper->do_match(
    'fromxml',
    [qw(--element server,inner --nested file:tests/files/xml1)],
    '',
    $solution3,
  );
}
