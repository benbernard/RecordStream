package RecsSDK;

# RecordStream Perl SDK — optional utility module for snippet authors.
#
# In the standard snippet environment $r is a plain hashref, exactly
# like the original App::RecordStream.  This module is available for
# users who want KeySpec-style access (nested paths, array indices,
# fuzzy matching) from Perl code.

use strict;
use warnings;

sub new {
    my ($class, $data) = @_;
    $data = {} unless defined $data;
    return bless { data => $data }, $class;
}

# get($keyspec) — resolve a /-separated key path.
#   foo/bar      => $data->{foo}{bar}
#   foo/#0       => $data->{foo}[0]
#   foo/#0/bar   => $data->{foo}[0]{bar}
sub get {
    my ($self, $keyspec) = @_;
    return _resolve($self->{data}, $keyspec);
}

# set($keyspec, $value) — set a value at a /-separated key path,
# auto-vivifying intermediate hashes or arrays as needed.
sub set {
    my ($self, $keyspec, $value) = @_;
    _set_path($self->{data}, $keyspec, $value);
    return $value;
}

sub to_hash {
    my ($self) = @_;
    return $self->{data};
}

# --- internal helpers ---

sub _resolve {
    my ($node, $keyspec) = @_;
    return $node unless defined $keyspec && length $keyspec;

    my @parts = _split_keyspec($keyspec);
    for my $part (@parts) {
        return undef unless defined $node;
        if ($part =~ /^#(\d+)$/) {
            my $idx = $1;
            return undef unless ref($node) eq 'ARRAY';
            $node = $node->[$idx];
        } else {
            return undef unless ref($node) eq 'HASH';
            $node = $node->{$part};
        }
    }
    return $node;
}

sub _set_path {
    my ($node, $keyspec, $value) = @_;
    my @parts = _split_keyspec($keyspec);
    return unless @parts;

    for my $i (0 .. $#parts - 1) {
        my $part = $parts[$i];
        my $next_part = $parts[$i + 1];
        my $next_is_array = ($next_part =~ /^#\d+$/);

        if ($part =~ /^#(\d+)$/) {
            my $idx = $1;
            if (!defined $node->[$idx] || ref($node->[$idx]) eq '') {
                $node->[$idx] = $next_is_array ? [] : {};
            }
            $node = $node->[$idx];
        } else {
            if (!defined $node->{$part} || ref($node->{$part}) eq '') {
                $node->{$part} = $next_is_array ? [] : {};
            }
            $node = $node->{$part};
        }
    }

    my $last = $parts[-1];
    if ($last =~ /^#(\d+)$/) {
        $node->[$1] = $value;
    } else {
        $node->{$last} = $value;
    }
}

sub _split_keyspec {
    my ($keyspec) = @_;
    # Split on / but allow \/ as an escaped literal slash
    my @raw = split m{(?<!\\)/}, $keyspec;
    return map { s{\\/}{/}g; $_ } @raw;
}

1;
