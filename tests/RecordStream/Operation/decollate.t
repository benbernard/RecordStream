use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::decollate' ) };

# test split and some general decollate stuff
{
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
}

# test double split
{
    my $stream = <<STREAM;
{"r":1,"first":"a_b_c/d_e"}
{"r":2,"first":"f_g/h_i_j_k/l"}
{"r":3,"first":"m"}
STREAM

    my $solution1 = <<SOLUTION;
{"r":1,"first":"a_b_c/d_e","second":"a_b_c"}
{"r":1,"first":"a_b_c/d_e","second":"d_e"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"f_g"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"h_i_j_k"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"l"}
{"r":3,"first":"m","second":"m"}
SOLUTION

    App::RecordStream::Test::OperationHelper->do_match(
       'decollate',
       ['-d', 'split,first,/,second'],
       $stream,
       $solution1,
    );

    my $solution2 = <<SOLUTION;
{"r":1,"first":"a_b_c/d_e","second":"a_b_c","third":"a"}
{"r":1,"first":"a_b_c/d_e","second":"a_b_c","third":"b"}
{"r":1,"first":"a_b_c/d_e","second":"a_b_c","third":"c"}
{"r":1,"first":"a_b_c/d_e","second":"d_e","third":"d"}
{"r":1,"first":"a_b_c/d_e","second":"d_e","third":"e"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"f_g","third":"f"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"f_g","third":"g"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"h_i_j_k","third":"h"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"h_i_j_k","third":"i"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"h_i_j_k","third":"j"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"h_i_j_k","third":"k"}
{"r":2,"first":"f_g/h_i_j_k/l","second":"l","third":"l"}
{"r":3,"first":"m","second":"m","third":"m"}
SOLUTION

    App::RecordStream::Test::OperationHelper->do_match(
       'decollate',
       ['-d', 'split,first,/,second', '-d', 'split,second,_,third'],
       $stream,
       $solution2,
    );
}

# test unhash
{
    my $stream = <<STREAM;
{"hr":{"k1":"v1","k2":"v2"}}
STREAM

    my $solution = <<SOLUTION;
{"hr":{"k1":"v1","k2":"v2"},"k":"k1","v":"v1"}
{"hr":{"k1":"v1","k2":"v2"},"k":"k2","v":"v2"}
SOLUTION

    my $solution_k = <<SOLUTION;
{"hr":{"k1":"v1","k2":"v2"},"k":"k1"}
{"hr":{"k1":"v1","k2":"v2"},"k":"k2"}
SOLUTION

    App::RecordStream::Test::OperationHelper->do_match(
       'decollate',
       ['-d', 'unhash,hr,k,v'],
       $stream,
       $solution,
    );

    App::RecordStream::Test::OperationHelper->do_match(
       'decollate',
       ['-d', 'unhash,hr,k'],
       $stream,
       $solution_k,
    );
}

# test unarray
{
    my $stream = <<STREAM;
{"ar":[1,2,"suxco"]}
STREAM

    my $solution = <<SOLUTION;
{"ar":[1,2,"suxco"],"v":1}
{"ar":[1,2,"suxco"],"v":2}
{"ar":[1,2,"suxco"],"v":"suxco"}
SOLUTION

    App::RecordStream::Test::OperationHelper->do_match(
       'decollate',
       ['-d', 'unarray,ar,v'],
       $stream,
       $solution,
    );
}
