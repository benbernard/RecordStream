package RecsSDK;

# RecordStream Perl SDK for snippet execution.
#
# The object IS the data hashref (blessed directly), so $r->{field}
# works for direct access and $r->get("a/b") works for KeySpec access.
# This matches the original App::RecordStream::Record design.

use strict;
use warnings;
use Scalar::Util qw(reftype);

sub new {
    my ($class, $data) = @_;
    $data = {} unless defined $data;
    return bless $data, $class;
}

# get($keyspec) — resolve a /-separated key path.
#   foo/bar      => $self->{foo}{bar}
#   foo/#0       => $self->{foo}[0]
#   foo/#0/bar   => $self->{foo}[0]{bar}
sub get {
    my ($self, $keyspec) = @_;
    return _resolve($self, $keyspec);
}

# set($keyspec, $value) — set a value at a /-separated key path,
# auto-vivifying intermediate hashes or arrays as needed.
sub set {
    my ($self, $keyspec, $value) = @_;
    _set_path($self, $keyspec, $value);
    return $value;
}

# has($keyspec) — check whether a key path exists.
sub has {
    my ($self, $keyspec) = @_;
    return defined _resolve($self, $keyspec);
}

sub to_hash {
    my ($self) = @_;
    return { %$self };
}

# TO_JSON — called by JSON::PP with convert_blessed to serialize.
sub TO_JSON {
    my ($self) = @_;
    return { %$self };
}

# --- internal helpers ---

sub _resolve {
    my ($node, $keyspec) = @_;
    return $node unless defined $keyspec && length $keyspec;

    my @parts = _split_keyspec($keyspec);
    for my $part (@parts) {
        return undef unless defined $node;
        my $rt = reftype($node) // '';
        if ($part =~ /^#(\d+)$/) {
            my $idx = $1;
            return undef unless $rt eq 'ARRAY';
            $node = $node->[$idx];
        } else {
            return undef unless $rt eq 'HASH';
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
        my $rt = reftype($node) // '';

        if ($part =~ /^#(\d+)$/) {
            my $idx = $1;
            if (!defined $node->[$idx] || !ref($node->[$idx])) {
                $node->[$idx] = $next_is_array ? [] : {};
            }
            $node = $node->[$idx];
        } else {
            if (!defined $node->{$part} || !ref($node->{$part})) {
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
