use App::RecordStream::Test::Tester;

# This test is a little silly.  Without mocking out more of the MongoDB
# interface we aren't testing much here...

BEGIN {
  eval {
    require MongoDB;
    require JSON::PP;
  };

  if ( $@ ) {
    require Test::More;
    import Test::More skip_all => 'Missing modules! (MongoDB or JSON::PP)!';
  }
  else {
    require Test::More;
    import Test::More qw(no_plan);
    use_ok( 'App::RecordStream::Operation::frommongo' );
  }
};

my $keeper = App::RecordStream::Test::OperationHelper::Keeper->new();
my $op = App::RecordStream::Operation::frommongo->new(
  [qw(--host localhost --name my_db --user foo --pass bar --query {} --collection zip)],
  $keeper
);

ok($op, "Frommongo initialized");

my $cursor = MockCursor->new([
  {foo => 'bar',  zip => 2},
  {zap => 'blah', car => 8},
]);

$op->{'CURSOR'} = $cursor;

$op->finish();

my $solution = [
  {foo => 'bar',  zip => 2},
  {zap => 'blah', car => 8},
];

is_deeply($keeper->get_records(), $solution, "Records from Cursor are output");

package MockCursor;

sub new {
  my $class   = shift;
  my $objects = shift;
  return bless {
    OBJECTS => $objects,
    INDEX   => 0,
  }, $class;
}

sub next {
  my $this = shift;

  my $object = $this->{'OBJECTS'}->[$this->{'INDEX'}];
  $this->{'INDEX'}++;

  return $object;
}

1;
