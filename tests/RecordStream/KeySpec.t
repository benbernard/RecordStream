use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

use App::RecordStream::Record;

BEGIN { use_ok("App::RecordStream::KeySpec"); }

{
  my $rec = App::RecordStream::Record->new("first_key" => "foo", "second_key" => { "bar" => "biz"}, 0 => "zero");
  my $spec = App::RecordStream::KeySpec->new("first_key");
  is(${$spec->guess_key($rec)}, "foo", "Exact key spec match");

  is(${App::RecordStream::KeySpec::find_key($rec,"first_key")}, "foo", "Exact key spec match");
  is(${App::RecordStream::KeySpec::find_key($rec,"does_not_exist")}, undef, "key doesn't exist");
  is(${App::RecordStream::KeySpec::find_key($rec,"second_key/bar")}, "biz", "nested hash");
  is(${App::RecordStream::KeySpec::find_key($rec,"\@first")}, "foo", "Prefix matching");
  is(${App::RecordStream::KeySpec::find_key($rec,"\@cond/ar")}, "biz", "nested substring matching");
  is(${App::RecordStream::KeySpec::find_key($rec,"0")}, "zero", "number only first level");
  is(${App::RecordStream::KeySpec::find_key($rec,'@0')}, "zero", "number only first level, matching");

}
