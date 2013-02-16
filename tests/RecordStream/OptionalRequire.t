use Test::More qw(no_plan);

BEGIN { require_ok( 'App::RecordStream::OptionalRequire' ) };

$App::RecordStream::OptionalRequire::PRINT_WARNING = 0;

my $loaded = App::RecordStream::OptionalRequire::optional_use(qw(Foo::Bar));
is($loaded, 0, 'Test nonexistant module load');

$loaded = App::RecordStream::OptionalRequire::optional_use(qw(App::RecordStream::Operation));
is($loaded, 1, 'Test existing module load');

$loaded = App::RecordStream::OptionalRequire::optional_use(qw(JSON));
is($loaded, 1, 'Test external module with extra args');

my $json = new JSON;
my $hash = $json->decode('{"foo": "bar"}');
is($hash->{'foo'}, 'bar', "Test useing loaded method");

