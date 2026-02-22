#!/usr/bin/env perl

# Unit tests for the RecsSDK Perl module.

use strict;
use warnings;
use Test::More;
use FindBin;
use lib "$FindBin::Bin/../../../src/snippets/perl";
use RecsSDK;

# ----------------------------------------------------------------
# Construction
# ----------------------------------------------------------------

subtest 'new creates object with data' => sub {
    my $sdk = RecsSDK->new({ name => 'alice', age => 30 });
    isa_ok($sdk, 'RecsSDK');
    is_deeply($sdk->to_hash(), { name => 'alice', age => 30 });
};

subtest 'new with empty hash' => sub {
    my $sdk = RecsSDK->new({});
    is_deeply($sdk->to_hash(), {});
};

subtest 'new with no arguments' => sub {
    my $sdk = RecsSDK->new();
    is_deeply($sdk->to_hash(), {});
};

# ----------------------------------------------------------------
# get()
# ----------------------------------------------------------------

subtest 'get simple key' => sub {
    my $sdk = RecsSDK->new({ name => 'alice', age => 30 });
    is($sdk->get('name'), 'alice');
    is($sdk->get('age'), 30);
};

subtest 'get nested key' => sub {
    my $sdk = RecsSDK->new({ user => { profile => { email => 'a@b.com' } } });
    is($sdk->get('user/profile/email'), 'a@b.com');
};

subtest 'get array index' => sub {
    my $sdk = RecsSDK->new({ scores => [10, 20, 30] });
    is($sdk->get('scores/#0'), 10);
    is($sdk->get('scores/#2'), 30);
};

subtest 'get array inside hash' => sub {
    my $sdk = RecsSDK->new({ data => { items => [{ x => 1 }, { x => 2 }] } });
    is($sdk->get('data/items/#0/x'), 1);
    is($sdk->get('data/items/#1/x'), 2);
};

subtest 'get missing key returns undef' => sub {
    my $sdk = RecsSDK->new({ a => 1 });
    is($sdk->get('missing'), undef);
    is($sdk->get('a/deep/path'), undef);
};

# ----------------------------------------------------------------
# set()
# ----------------------------------------------------------------

subtest 'set simple key' => sub {
    my $sdk = RecsSDK->new({});
    $sdk->set('name', 'bob');
    is($sdk->get('name'), 'bob');
};

subtest 'set nested key with auto-vivification' => sub {
    my $sdk = RecsSDK->new({});
    $sdk->set('a/b/c', 42);
    is($sdk->get('a/b/c'), 42);
    is_deeply($sdk->to_hash(), { a => { b => { c => 42 } } });
};

subtest 'set array index with auto-vivification' => sub {
    my $sdk = RecsSDK->new({});
    $sdk->set('items/#0', 'first');
    is($sdk->get('items/#0'), 'first');
    is_deeply($sdk->to_hash(), { items => ['first'] });
};

subtest 'set overwrites existing value' => sub {
    my $sdk = RecsSDK->new({ x => 1 });
    $sdk->set('x', 2);
    is($sdk->get('x'), 2);
};

# ----------------------------------------------------------------
# Backwards compat: $r as plain hashref
# ----------------------------------------------------------------

subtest 'plain hashref access (backwards compatibility)' => sub {
    my $r = { name => 'alice', age => 30, nested => { key => 'val' } };

    # Direct hashref access — the primary way snippets work
    is($r->{name}, 'alice');
    is($r->{age}, 30);
    is($r->{nested}{key}, 'val');

    # Modify in place
    $r->{age} = 31;
    is($r->{age}, 31);

    # Add a field
    $r->{new_field} = 'hello';
    is($r->{new_field}, 'hello');

    # Delete a field
    delete $r->{new_field};
    ok(!exists $r->{new_field});
};

subtest 'RecsSDK wraps hashref for keyspec access' => sub {
    my $r = { name => 'alice', address => { city => 'Seattle' } };
    my $sdk = RecsSDK->new($r);

    # KeySpec access
    is($sdk->get('address/city'), 'Seattle');

    # Modifications through SDK reflect in original hashref
    $sdk->set('address/state', 'WA');
    is($r->{address}{state}, 'WA');

    # to_hash returns the same ref
    is($sdk->to_hash(), $r);
};

# ----------------------------------------------------------------
# Edge cases
# ----------------------------------------------------------------

subtest 'escaped slash in keyspec' => sub {
    my $sdk = RecsSDK->new({ 'a/b' => 42 });
    is($sdk->get('a\\/b'), 42);
};

subtest 'deeply nested set and get' => sub {
    my $sdk = RecsSDK->new({});
    $sdk->set('a/b/c/d/e', 'deep');
    is($sdk->get('a/b/c/d/e'), 'deep');
};

subtest 'mixed hash and array nesting' => sub {
    my $sdk = RecsSDK->new({});
    $sdk->set('users/#0/name', 'alice');
    $sdk->set('users/#1/name', 'bob');
    is($sdk->get('users/#0/name'), 'alice');
    is($sdk->get('users/#1/name'), 'bob');
};

done_testing();
