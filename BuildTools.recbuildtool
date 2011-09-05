package BuildTools;

use base qw(Exporter);

use File::Find;

our @EXPORT_OK = qw(get_bin_scripts run_command get_pms);

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


sub get_pms {
   my @pms;

   my $wanted = sub {
      push @pms, $File::Find::name if ( -f $_ );
   };

   File::Find::find({wanted => $wanted}, 'lib');

   return map { $_ =~ s/^lib\///; $_ } @pms;
}

1;
