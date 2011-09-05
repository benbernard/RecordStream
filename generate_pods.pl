#!/usr/bin/perl -w

use strict;
use File::Basename qw(basename);

require 'BuildTools.recbuildtool';

$ENV{'PERL5LIB'} .= ':lib';

my @scripts = BuildTools::get_bin_scripts();

foreach my $script (@scripts) {
   generate_pod("bin/$script");
}

sub generate_pod {
   my $script = shift;

   print "Generating pod documentation for $script\n";

   my $script_base = basename($script);

   my @help = `$script --help-all 2>/dev/null`;

   open(my $fh, '>', "doc/$script_base.pod") or die "Could not open doc/$script.pod: $!";

   print $fh <<HEADER;
=head1 NAME

$script_base

=head1 $script_base --help-all

HEADER

   foreach my $line (@help) {
      print  $fh " " . $line;
   }

   print $fh <<FOOTER;

=head1 See Also

=over

=item  L<RecordStream(3)> - Overview of the scripts and the system

=item  L<recs-examples(3)> - A set of simple recs examples

=item  L<recs-story(3)> - A humorous introduction to RecordStream

=item SCRIPT --help - every script has a --help option, like the output above

=back

FOOTER

   close $fh;
}
