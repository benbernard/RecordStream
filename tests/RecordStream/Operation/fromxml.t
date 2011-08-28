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
{"osversion":"2.6","osname":"solaris","name":"sahara","address":["10.0.0.101","10.0.1.101"]}
{"osversion":"6.5","osname":"irix","name":"gobi","address":["10.0.0.102"]}
{"osversion":"2.0.34","osname":"linux","name":"kalahari","address":["10.0.0.103","10.0.1.103"]}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'fromxml',
   [qw(--element server file:tests/files/xml1)],
   '',
   $solution2,
);
