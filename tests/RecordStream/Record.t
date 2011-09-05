use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Record"); }

{
   my $rec = App::RecordStream::Record->new("a" => "b", "c" => "d");

   # Check all the const functions
   is($rec->get_a(), "b", "get_a()");
   is($rec->get_c(), "d", "get_c()");
   is($rec->get_x(), undef, "get_x()");
   is($rec->get('a'), "b", "get('a')");
   is($rec->get('c'), "d", "get('c')");
   is($rec->get('x'), undef, "get('x')");
   ok($rec->exists('a'), "exists('a')");
   ok($rec->exists('c'), "exists('c')");
   ok(!$rec->exists('x'), "exists('x')");
   is_deeply({map { ($_ => 1) } ($rec->keys())}, {"a" => 1, "c" => 1}, "keys hash");
   is_deeply({$rec->as_hash()}, {"a" => "b", "c" => "d"}, "as_hash");

   # try basic setters

   is($rec->set_a('b2'), "b", "set_a('b2')");
   is($rec->get_a(), "b2", "get_a()");

   is($rec->set_x('y'), undef, "set_x('y')");
   is($rec->get_x(), "y", "get_x()");
}

{
   my $rec = App::RecordStream::Record->new("a" => "b", "c" => "d");

   is_deeply([$rec->remove('a')], ["b"], "remove('a')");

   is_deeply({$rec->as_hash()}, {"c" => "d"}, "as_hash()");
}

{
   my $rec = App::RecordStream::Record->new("a" => "b", "c" => "d");

   is_deeply([$rec->remove('x')], [undef], "remove('x')");

   is_deeply({$rec->as_hash()}, {"a" => "b", "c" => "d"}, "as_hash()");
}

{
   my $rec = App::RecordStream::Record->new("a" => "b", "c" => "d");

   $rec->rename("a", "a2");

   is_deeply({$rec->as_hash()}, {"a2" => "b", "c" => "d"}, "as_hash()");
}

{
   my $rec = App::RecordStream::Record->new("a" => "b", "c" => "d");

   $rec->rename("a", "c");

   is_deeply({$rec->as_hash()}, {"c" => "b"}, "as_hash()");
}

{
   my $rec = App::RecordStream::Record->new("a" => "b", "c" => "d");

   $rec->rename("x", "x2");

   is_deeply({$rec->as_hash()}, {"a" => "b", "c" => "d", "x2" => undef}, "as_hash()");
}

{
   my $rec = App::RecordStream::Record->new("a" => "b", "c" => "d", "e" => "f", "g" => "h");

   $rec->prune_to("a", "e", "x");

   is_deeply({$rec->as_hash()}, {"a" => "b", "e" => "f"});
}

{
   my $rec = App::RecordStream::Record->new("n" => "2", "s" => "a");
   my $rec2 = App::RecordStream::Record->new("n" => "10", "s" => "b");

   is($rec->cmp($rec2, "n"), 1, "lexical (implicit) 2 <=> 10");
   is($rec->cmp($rec2, "n="), 1, "lexical '' 2 <=> 10");
   is($rec->cmp($rec2, "n=lex"), 1, "lexical 'lex' 2 <=> 10");
   is($rec->cmp($rec2, "n=lexical"), 1, "lexical 'lexical' 2 <=> 10");
   is($rec->cmp($rec2, "n=-"), -1, "-lexical '-' 2 <=> 10");
   is($rec->cmp($rec2, "n=-lex"), -1, "-lexical '-lex' 2 <=> 10");
   is($rec->cmp($rec2, "n=-lexical"), -1, "-lexical '-lexical' 2 <=> 10");

   is($rec->cmp($rec2, "n=nat"), -1, "natural 'nat' 2 <=> 10");
   is($rec->cmp($rec2, "n=natural"), -1, "natural 'natural' 2 <=> 10");
   is($rec->cmp($rec2, "n=-nat"), 1, "-natural '-nat' 2 <=> 10");
   is($rec->cmp($rec2, "n=-natural"), 1, "-natural '-natural' 2 <=> 10");

   is($rec->cmp($rec2, "s"), -1, "lexical (implicit) a <=> b");
   is($rec->cmp($rec2, "s="), -1, "lexical '' a <=> b");
   is($rec->cmp($rec2, "s=lex"), -1, "lexical 'lex' a <=> b");
   is($rec->cmp($rec2, "s=lexical"), -1, "lexical 'lexical' a <=> b");
   is($rec->cmp($rec2, "s=-"), 1, "-lexical '-' a <=> b");
   is($rec->cmp($rec2, "s=-lex"), 1, "-lexical '-lex' a <=> b");
   is($rec->cmp($rec2, "s=-lexical"), 1, "-lexical '-lexical' a <=> b");
}

{
   my $rec11 = App::RecordStream::Record->new("f1" => "1", "f2" => "1");
   my $rec12 = App::RecordStream::Record->new("f1" => "1", "f2" => "2");
   my $rec13 = App::RecordStream::Record->new("f1" => "1", "f2" => "3");
   my $rec21 = App::RecordStream::Record->new("f1" => "2", "f2" => "1");
   my $rec22 = App::RecordStream::Record->new("f1" => "2", "f2" => "2");
   my $rec23 = App::RecordStream::Record->new("f1" => "2", "f2" => "3");
   my $rec31 = App::RecordStream::Record->new("f1" => "3", "f2" => "1");
   my $rec32 = App::RecordStream::Record->new("f1" => "3", "f2" => "2");
   my $rec33 = App::RecordStream::Record->new("f1" => "3", "f2" => "3");

   is($rec11->cmp($rec12, "f1"), 0, "rec11 <=> rec12, f1");
   is($rec21->cmp($rec12, "f1"), 1, "rec21 <=> rec12, f1");
   is($rec11->cmp($rec22, "f1"), -1, "rec11 <=> rec22, f1");

   is($rec22->cmp($rec22, "f1", "f2"), 0, "rec22 <=> rec22, f1, f2");

   is($rec22->cmp($rec13, "f1", "f2"), 1, "rec22 <=> rec13, f1, f2");
   is($rec22->cmp($rec31, "f1", "f2"), -1, "rec22 <=> rec31, f1, f2");

   is($rec22->cmp($rec21, "f1", "f2"), 1, "rec22 <=> rec21, f1, f2");
   is($rec22->cmp($rec23, "f1", "f2"), -1, "rec22 <=> rec23, f1, f2");
}

{
   my $rec11 = App::RecordStream::Record->new("f1" => "1", "f2" => "1");
   my $rec12 = App::RecordStream::Record->new("f1" => "1", "f2" => "2");
   my $rec13 = App::RecordStream::Record->new("f1" => "1", "f2" => "3");
   my $rec21 = App::RecordStream::Record->new("f1" => "2", "f2" => "1");
   my $rec22 = App::RecordStream::Record->new("f1" => "2", "f2" => "2");
   my $rec23 = App::RecordStream::Record->new("f1" => "2", "f2" => "3");
   my $rec31 = App::RecordStream::Record->new("f1" => "3", "f2" => "1");
   my $rec32 = App::RecordStream::Record->new("f1" => "3", "f2" => "2");
   my $rec33 = App::RecordStream::Record->new("f1" => "3", "f2" => "3");

   my @sorted = App::RecordStream::Record::sort([$rec11, 
                                    $rec12, 
                                    $rec13, 
                                    $rec21, 
                                    $rec22, 
                                    $rec23, 
                                    $rec31, 
                                    $rec32, 
                                    $rec33,], 
                                    qw(f2=-natural f1=natural));

   is_deeply($rec13, shift @sorted, "rec13 sorted correctly");
   is_deeply($rec23, shift @sorted, "rec23 sorted correctly");
   is_deeply($rec33, shift @sorted, "rec33 sorted correctly");

   is_deeply($rec12, shift @sorted, "rec12 sorted correctly");
   is_deeply($rec22, shift @sorted, "rec22 sorted correctly");
   is_deeply($rec32, shift @sorted, "rec32 sorted correctly");

   is_deeply($rec11, shift @sorted, "rec11 sorted correctly");
   is_deeply($rec21, shift @sorted, "rec21 sorted correctly");
   is_deeply($rec31, shift @sorted, "rec31 sorted correctly");
}

{
  my $rec = App::RecordStream::Record->new("first_key" => "foo", "second_key" => { "bar" => "biz"}, 0 => "zero");
  is(${$rec->guess_key_from_spec("first_key")}, "foo", "Exact key spec match");
  is(${$rec->guess_key_from_spec("does_not_exist")}, undef, "key doesn't exist");
  is(${$rec->guess_key_from_spec("second_key/bar")}, "biz", "nested hash");
  is(${$rec->guess_key_from_spec("\@first")}, "foo", "Prefix matching");
  is(${$rec->guess_key_from_spec("\@cond/ar")}, "biz", "nested substring matching");
  is(${$rec->guess_key_from_spec("0")}, "zero", "number only first level");
  is(${$rec->guess_key_from_spec('@0')}, "zero", "number only first level, matching");

  ${$rec->guess_key_from_spec("third_key/0")} = 3;
  ok($rec->{"third_key"}->{"0"} == 3, "Auto vivification of hash");

  ${$rec->guess_key_from_spec("fourth_key/#0")} = 3;
  ok($rec->{"fourth_key"}->[0] == 3, "Auto vivification of array");

  ${$rec->guess_key_from_spec("fourth_key_a/#5")} = 3;
  ok($rec->{"fourth_key_a"}->[5] == 3, "Auto vivification of array, non first-index");

  ${$rec->guess_key_from_spec("fifth_key")} = 3;
  ok($rec->{"fifth_key"} == 3, "First level vivification");

  ${$rec->guess_key_from_spec("sixth_key")} = [qw(a b c), {foo=>'bar'}];
  is(${$rec->guess_key_from_spec("sixth_key/#2")}, 'c', "Index into an array, with sharp");
  is(${$rec->guess_key_from_spec("sixth_key/#3/foo")}, 'bar', "Descend into hash after array");

  ${$rec->guess_key_from_spec('seventh_key\\/after_slash')} = 10;
  is($rec->{'seventh_key/after_slash'}, 10, "Escape forward slash");

  my $rec2 = App::RecordStream::Record->new();
  ${$rec->guess_key_from_spec('@third')} = 11;
  is($rec->{'third_key'}, 11, "Key names persist across records");

  my $rec3 = App::RecordStream::Record->new();
  $rec3->guess_key_from_spec('foo/bar', 0);
  is_deeply({$rec2->as_hash()}, {}, "No Autovivification");

  my $rec4 = App::RecordStream::Record->new("biz"=>'zap');
  eval { $rec4->guess_key_from_spec('foo/bar', 0, 1); };
  is_deeply($@ =~ m/NoSuchKey/, 1, 'Throw error non nonexistent key');

  is($rec4->has_key_spec('foo/bar'), 0, 'Has keyspec reports failure');
  is($rec4->has_key_spec('@b'), 1, 'Has keyspec returns true for fuzzy matching');

  is(${$rec4->guess_key_from_spec('biz', 0, 1)}, 'zap', 'Do not throw error on existing key');

  #TODO: write key list test
  is_deeply($rec4->get_key_list_for_spec('@b'), ['biz'], "Keylist returns top level key");

  $rec4->{'roo'}->{'foo'} = [{one=>1}, {two=>2}, {three=>3}];

  is_deeply($rec4->get_key_list_for_spec('@r/f'), [qw(roo foo)], "Key list nesting with hashes");
  is_deeply($rec4->get_key_list_for_spec('@r/f/#1/tw'), ['roo', 'foo', '#1', 'two'], "Key list nesting with arrays");
  is_deeply($rec4->get_key_list_for_spec('not_here'), [], "Key list returns empty array on not present");

  my $rec5 = App::RecordStream::Record->new('foo'=>'bar');
  $rec5->get_key_list_for_spec('not_here');
  is_deeply({$rec5->as_hash()}, {foo => 'bar'}, "get_key_list_for_spec doesn't auto-vivify");
  $rec5->get_key_list_for_spec('not_here/zap');
  is_deeply({$rec5->as_hash()}, {foo => 'bar'}, "get_key_list_for_spec doesn't auto-vivify, nested spec");


  my $rec6 = App::RecordStream::Record->new('foo'=>'bar', zoo=>'zap');
  is_deeply($rec6->get_keys_for_group('!oo!s'), [qw(foo zoo)], "Groups from record");

  my $rec7 = App::RecordStream::Record->new('foo'=>'bar', zoo=>'zap', 'coo'=>'cap');
  is_deeply($rec7->get_keys_for_group('!oo!s'), [qw(foo zoo)], "Groups from record, no re-run");
  is_deeply($rec7->get_keys_for_group('!oo!s', 1), [qw(coo foo zoo)], "Groups from record, with re-run");
  is_deeply($rec7->get_group_values('!oo!s', 1), [qw(cap bar zap)], "Groups from record, with re-run");
}
