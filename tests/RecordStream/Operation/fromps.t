use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::fromps' ) };

my $solution = <<STREAM;
{ "uid" : "bernard", "pid" : "1", "ppid" : "0"}
{ "uid" : "bernard", "pid" : "2", "ppid" : "1"}
{ "uid" : "bernard", "pid" : "3", "ppid" : "0"}
{ "uid" : "bernard", "pid" : "4", "ppid" : "2"}
STREAM

my $converter = sub { return 'bernard' };

my $op = App::RecordStream::Operation::fromps->new([]);
$op->set_converter($converter);
$op->set_process_table(MockTable->new());

my $helper = App::RecordStream::Test::OperationHelper->new(
    operation => $op,
    input     => '',
    output    => $solution,
);

$helper->matches();

package MockTable;

sub new {
   my $class = shift;
   my $this = {};
   bless $this, $class;
   return $this;
}

sub table {
   return [
      { uid => '1003', pid => 1, ppid => 0},
      { uid => '1003', pid => 2, ppid => 1},
      { uid => '1003', pid => 3, ppid => 0},
      { uid => '1003', pid => 4, ppid => 2},
   ];
}

sub fields {
   return qw(uid pid ppid);
}

1;
