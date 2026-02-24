#!/usr/bin/env perl

# RecordStream Perl snippet runner.
#
# Protocol: JSONL over stdin/stdout (same as Python SDK).
#
# 1. TS -> Perl: {"type":"init","code":"...","mode":"eval|grep|xform|generate"}
# 2. TS -> Perl: {"type":"record","data":{...}}
# 3. Perl -> TS: mode-dependent result messages
# 4. TS -> Perl: {"type":"done"}
# 5. On error:   {"type":"error","message":"..."}

use strict;
use warnings;

use JSON::PP;
use Scalar::Util qw(blessed reftype);
use FindBin;
use lib $FindBin::Bin;
use RecsSDK;

my $json = JSON::PP->new->utf8->canonical->allow_blessed->convert_blessed;

# ----------------------------------------------------------------
# I/O helpers
# ----------------------------------------------------------------

sub read_message {
    my $line = <STDIN>;
    return undef unless defined $line;
    chomp $line;
    return $json->decode($line);
}

sub write_message {
    my ($msg) = @_;
    eval {
        print $json->encode($msg) . "\n";
        STDOUT->flush();
    };
    return !$@;
}

sub send_result   { write_message({ type => "result",      data   => $_[0] }) }
sub send_filter   { write_message({ type => "filter",      passed => $_[0] ? JSON::PP::true : JSON::PP::false }) }
sub send_emit     { write_message({ type => "emit",        data   => $_[0] }) }
sub send_done     { write_message({ type => "record_done" }) }
sub send_error    { write_message({ type => "error",       message => $_[0] }) }

# Check if a value is a hashref (blessed or plain)
sub _is_hash { return ref($_[0]) && (reftype($_[0]) // '') eq 'HASH' }

# ----------------------------------------------------------------
# Read init message
# ----------------------------------------------------------------

my $init = read_message();
unless ($init && $init->{type} eq 'init') {
    send_error("Expected init message, got: " . ($init ? $json->encode($init) : "EOF"));
    exit 1;
}

my $code = $init->{code};
my $mode = $init->{mode};

unless (grep { $_ eq $mode } qw(eval grep xform generate)) {
    send_error("Unknown mode: $mode");
    exit 1;
}

# ----------------------------------------------------------------
# __get / __set helpers for {{}} template expansion
# ----------------------------------------------------------------

sub __get {
    my ($r, $keyspec) = @_;
    return RecsSDK::_resolve($r, $keyspec);
}

sub __set {
    my ($r, $keyspec, $value) = @_;
    RecsSDK::_set_path($r, $keyspec, $value);
    return $value;
}

# ----------------------------------------------------------------
# Compile snippet
# ----------------------------------------------------------------

# Collected records from push_record calls (xform/generate modes)
my @_emitted;

# push_record — available in xform/generate snippet scope.
# Users call push_record($hashref) to emit a record.
sub push_record {
    for my $rec (@_) {
        if (_is_hash($rec)) {
            push @_emitted, $rec;
        }
    }
}

my $compiled;

if ($mode eq 'eval') {
    # Eval mode: snippet is an expression. The last expression's value
    # becomes the result. We wrap it so $r is potentially modified and returned.
    $compiled = eval qq{
        no strict; no warnings;
        sub {
            my (\$r, \$line, \$filename) = \@_;
            $code;
            \$r;
        }
    };
} elsif ($mode eq 'grep') {
    # Grep mode: snippet is a predicate expression. Return value is truthy/falsy.
    $compiled = eval qq{
        no strict; no warnings;
        sub {
            my (\$r, \$line, \$filename) = \@_;
            $code;
        }
    };
} elsif ($mode eq 'xform' || $mode eq 'generate') {
    # Xform/generate mode: snippet can call push_record() to emit records.
    # The snippet's return value is also used: if it returns a hashref or
    # arrayref of hashrefs, those are emitted too (like original recs xform).
    $compiled = eval qq{
        no strict; no warnings;
        sub {
            my (\$r, \$line, \$filename) = \@_;
            $code;
            \$r;
        }
    };
}

if ($@) {
    send_error("Compilation error in $mode snippet: $@\nCode: $code");
    exit 1;
}

# ----------------------------------------------------------------
# Process records
# ----------------------------------------------------------------

my $line_num = 0;

while (my $msg = read_message()) {
    last if $msg->{type} eq 'done';
    next unless $msg->{type} eq 'record';

    $line_num++;
    my $r = RecsSDK->new($msg->{data});

    eval {
        if ($mode eq 'eval') {
            my $result = $compiled->($r, $line_num, $msg->{filename} // 'NONE');
            # $result should be the (possibly modified) $r
            $result = $r unless defined $result;
            send_result(_is_hash($result) ? $result : $r);

        } elsif ($mode eq 'grep') {
            my $passed = $compiled->($r, $line_num, $msg->{filename} // 'NONE');
            send_filter($passed);

        } elsif ($mode eq 'xform') {
            @_emitted = ();
            my $result = $compiled->($r, $line_num, $msg->{filename} // 'NONE');

            if (@_emitted) {
                # User called push_record explicitly
                for my $rec (@_emitted) {
                    send_emit($rec);
                }
            } else {
                # Use return value: could be arrayref of hashrefs, or a single hashref
                if (ref($result) eq 'ARRAY') {
                    for my $item (@$result) {
                        send_emit(_is_hash($item) ? $item : $r);
                    }
                } elsif (_is_hash($result)) {
                    send_emit($result);
                } elsif (defined $result) {
                    send_emit($r);
                }
                # undef result => suppress output (like original)
            }

        } elsif ($mode eq 'generate') {
            @_emitted = ();
            my $result = $compiled->($r, $line_num, $msg->{filename} // 'NONE');

            if (@_emitted) {
                for my $rec (@_emitted) {
                    send_emit($rec);
                }
            } else {
                if (ref($result) eq 'ARRAY') {
                    for my $item (@$result) {
                        send_emit($item) if _is_hash($item);
                    }
                } elsif (_is_hash($result) && $result != $r) {
                    # Only emit if it's a different hashref than $r
                    send_emit($result);
                }
            }
        }
    };

    if ($@) {
        send_error("Runtime error in $mode snippet: $@\nCode: $code");
        # Continue processing — send record_done so the TS side doesn't hang
    }

    send_done();
}
