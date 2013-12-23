package App::RecordStream::Operation::frommongo;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use MongoDB;
use Data::Dumper;
use JSON::PP;

sub init {
  my $this = shift;
  my $args = shift;

  my ($host, $user, $pass, $db_name, $query, $collection);

  my $spec = {
    "host=s"          => \$host,
    "user=s"          => \$user,
    "password|pass=s" => \$pass,
    "name|dbname=s"   => \$db_name,
    "query=s"         => \$query,
    "collection=s"    => \$collection,
  };

  $this->parse_options($args, $spec);

  unless(defined $host && defined $db_name && defined $query && defined $collection) {
    die "Must specify all of --host, --name, --collection, and --query\n";
  }

  my $params = {
    host    => $host,
    db_name => $db_name,
  };

  $params->{'username'} = $user if defined $user;
  $params->{'password'} = $pass if defined $pass;

  # This will come closer to allowing mongo-hq sytle json
  my $json = JSON::PP->new()
    ->allow_barekey() # Allow {navItem:[]} instead of {'navItem':[]}
    ->allow_singlequote() # allow single quotes for keys
    ->relaxed(1); # Allow trailing commas and comments in strings

  $this->{'CONNECT_PARAMS'} = $params;
  $this->{'DB_NAME'}        = $db_name;
  $this->{'COLLECTION'}     = $collection;
  $this->{'QUERY'}          = $json->decode($query);
}

sub wants_input {
  return 0;
}

sub stream_done {
  my $this = shift;

  my $cursor = $this->get_query();

  while (my $object = $cursor->next()) {
    $this->push_record($object);
  }
}

sub get_query {
  my $this = shift;

  # this momoization is really just a hook for tests
  if ($this->{'CURSOR'}) {
    return $this->{'CURSOR'};
  }

  # Initialize client here, otherwise authorization errors will also show usage
  my $client = MongoDB::MongoClient->new(
    %{$this->{'CONNECT_PARAMS'}},
  );

  my $db = $client->get_database($this->{'DB_NAME'});
  my $collection = $db->get_collection($this->{'COLLECTION'});
  return $this->{'CURSOR'} = $collection->find($this->{'QUERY'});
}

sub usage {
  my $this = shift;

  my $options = [
    [ 'host <HOST_URI>', 'URI for your mongo instance, may include user:pass@URI'],
    [ 'user <USER>', 'User to authenticate as.'],
    [ 'password <PASSWORD>', 'Password for --user'],
    [ 'name <DB_NAME>', 'Name of database to connect to'],
    [ 'collection <COLLECTION_NAME>', 'Name of collection to query against'],
    [ 'query <QUERY>', 'JSON query string to run against the --collection'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
recs-frommongo --host user:pass\@URI --name DB_NAME --collection COLLECTION --query QUERY
   __FORMAT_TEXT__
   Generate records from a MongoDB query.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
  Make a query against mongo hq
    recs-frommongo --host mongodb://user:pass\@dharma.mongohq.com:10069 --name my_app --collection my_collection --query '{doc_key: {\$not: {\$size: 0}}}'

USAGE
}

1;
