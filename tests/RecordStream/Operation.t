use Test::More qw(no_plan);

BEGIN { use_ok( 'App::RecordStream::Operation' ) };

my $op = App::RecordStream::Operation->new();

ok($op, "Constructor worked");

my ($foo);
my $args_spec = {
   'foo=s' => \$foo,
};

my $args = [ '--foo', 'bar', 'blah' ];
$op->parse_options($args, $args_spec);

ok($foo eq 'bar', "Option parsing test");
is_deeply($args, ['blah'], "Testing extra args");
