use Test::More qw(no_plan);

BEGIN { use_ok( 'App::RecordStream::Operation' ) };

my $op = App::RecordStream::Operation->new();

ok($op, "Constructor worked");

my ($foo);
my $args_spec = {
   'foo=s' => \$foo,
};

$op->parse_options([ '--foo', 'bar', 'blah' ], $args_spec);

ok($foo eq 'bar', "Option parsing test");
ok($op->_get_extra_args()->[0] eq 'blah', "Testing extra args");
