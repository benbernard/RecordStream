use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::decollate' ) };

my $stream = <<STREAM;
{"extra":"extra1","from":"inky_pinky_blinky_"}
{"extra2":"extra3","from":"_foo_bar"}
STREAM

my $solution = <<SOLUTION;
{"extra":"extra1","from":"inky_pinky_blinky_","to":"inky"}
{"extra":"extra1","from":"inky_pinky_blinky_","to":"pinky"}
{"extra":"extra1","from":"inky_pinky_blinky_","to":"blinky"}
{"extra":"extra1","from":"inky_pinky_blinky_","to":""}
{"extra2":"extra3","from":"_foo_bar","to":""}
{"extra2":"extra3","from":"_foo_bar","to":"foo"}
{"extra2":"extra3","from":"_foo_bar","to":"bar"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'decollate',
   ['-d', 'split,from,_,to'],
   $stream,
   $solution,
);
