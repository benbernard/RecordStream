package BuildTools;

use base qw(Exporter);

our @EXPORT_OK = qw(get_bin_scripts run_command);

sub get_bin_scripts {
   my $bin_dir = 'bin';
   opendir(my $dh, $bin_dir) || die "can't opendir $bin_dir: $!";
   my @scripts = grep { ! m/^\.|recs-operation/ } readdir($dh);
   closedir $dh;

   return @scripts;
}

sub run_command {
   my @command = @_;
   my $command_str = join(' ', @command);
   print "Running: $command_str\n";
   system(@command);

   if ( $? ) {
      warn "Failed running $command_str: $?";
   }
}

1;
