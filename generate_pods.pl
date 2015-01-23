#!/usr/bin/env perl

use strict;
use warnings;

use File::Basename qw(basename);

$ENV{'PERL5LIB'} .= ':lib';

# Don't let the actual terminal size affect POD every time we generate it.
# LINES isn't used by us, but is required for Term::ReadKey::GetTerminalSize()
# to use COLUMNS.
$ENV{'COLUMNS'} = 80;
$ENV{'LINES'}   = 50;

generate_pod($_) for grep { not /recs-operation/ } <bin/recs-*>;

sub generate_pod {
  my $script = shift;

  print "Generating pod documentation for $script\n";

  my $script_base = basename($script);

  my @help = `$script --help-all 2>/dev/null`;

  open(my $fh, '>', "doc/$script_base.pod") or die "Could not open doc/$script_base.pod: $!";

  print $fh <<HEADER;
=head1 NAME

$script_base

=head1 $script_base --help-all

HEADER

  foreach my $line (@help) {
    print  $fh " " . $line;
  }

  print $fh <<FOOTER;

=head1 SEE ALSO

=over

=item * See L<App::RecordStream> for an overview of the scripts and the system

=item * Run C<recs examples> or see L<App::RecordStream::Manual::Examples> for a set of simple recs examples

=item * Run C<recs story> or see L<App::RecordStream::Manual::Story> for a humorous introduction to RecordStream

=item * Every command has a C<--help> mode available to print out usage and
examples for the particular command, just like the output above.

=back

FOOTER

  close $fh;
}
