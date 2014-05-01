use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::assert' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1","boo":"boo1"}
{"foo":2,"zoo":null,"boo":"boo2"}
{"foo":3,"zoo":"biz3","boo":"boo3"}
STREAM

my ($ok, $err);

# Assertion held
$ok = eval {
  App::RecordStream::Test::OperationHelper->do_match(
    'assert',
    ['1'],
    $stream,
    $stream,
  );
  1;
};
$err = $@;
ok $ok, 'True assertion passes through records';
ok !$err, 'No error';

# Assertion broken
$ok = eval {
  App::RecordStream::Test::OperationHelper->do_match(
    'assert',
    ['{{zoo}}'],
    $stream,
    '',
  );
  1;
};
$err = $@;
ok !$ok, 'Failed assertion causes error';
ok $err, 'Caught error';
like $err, qr/\Q{{zoo}}\E/, 'Error contains expression';
like $err, qr/Line:\s*2/i, 'Error contains line number';

# Options
$ok = eval {
  App::RecordStream::Test::OperationHelper->do_match(
    'assert',
    [qw(-d ohhai -v {{zoo}})],
    $stream,
    '',
  );
  1;
};
$err = $@;
ok !$ok, 'Failed assertion causes error';
ok $err, 'Caught error';
like $err, qr/\Q{{zoo}}\E/, 'Error contains expression';
like $err, qr/Line:\s*2/i, 'Error contains line number';
like $err, qr/ohhai/, 'Error contains diagnostic';
like $err, qr/Record: \$r = \{.*?boo2/s, 'Error contains dumped record';
