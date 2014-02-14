package App::RecordStream::OptionalRequire;

=head1 NAME

App::RecordStream::OptionalRequire

=head1 AUTHOR

Benjamin Bernard <perlhacker@benjaminbernard.com>
Keith Amling <keith.amling@gmail.com>

=head1 DESCRIPTION

Class for optionally requiring a set of modules

=head1 SYNOPSIS

BEGIN { require App::RecordStream::OptionalRequire qw(optional_require); optional_require(qw(Foo::Bar Biz::Zip)); }

=cut

our $VERSION = "4.0.4";

use strict;
use warnings;

# Set to this 0 if you don't want the warnings printed
our $PRINT_WARNING = 1;

my @missing_modules;

sub import {
  my $class = shift;
  my $calling_package = (caller())[0];
  return optional_use_with_caller($calling_package, @_);
}

# For testing and calling outside of other things... CHECK will not work in this case...
sub optional_use {
  my $calling_package = (caller())[0];
  return optional_use_with_caller($calling_package, @_);
}

sub optional_use_with_caller {
  my $calling_package = shift;

  my $loaded;

  $loaded = use_module($calling_package, @_);
  my $module_name = $_[0];

  unless ( $loaded ) {
    warn "$0 requires missing module $module_name\n" if ( $PRINT_WARNING );
    push @missing_modules, $module_name;
    return 0;
  }

  return 1;
}

# CHECK runs after BEGIN blocks
sub require_done {
  if ( @missing_modules ) {
    die "Please install missing modules above to use this script\n";
  }
}

sub use_module {
  my $calling_package = shift;
  my $module = shift;
  my $args = join(' ', @_);
  if ( $args ) {
    $args = " qw($args)";
  }

  # Must use use here to invoke import
  eval <<EVAL;
package $calling_package;
use $module $args;
EVAL
  return not $@;
}

1;
