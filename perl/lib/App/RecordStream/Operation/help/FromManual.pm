use strict;
use warnings;

package App::RecordStream::Operation::help::FromManual;
use base qw(App::RecordStream::Operation::help);

use Pod::Perldoc;
use File::Temp qw< tempfile >;
use Scalar::Util qw< blessed >;

sub init_help {}
sub init {
  my $this = shift;
  local @ARGV = ('-F', $this->pod_file);
  Pod::Perldoc->run();
}

sub pod_file {
  my $this = shift;
  my ($class, $pm) = $this->manual_class;
  my $source = $INC{$pm};

  # Simple case: manual class is on disk already
  if (not ref $source and -e $source) {
    return $source;
  }
  # Fatpacked: read from the @INC hook
  elsif (ref $source and blessed($source) =~ /^FatPacked::/) {
    my $source_fh = $source->INC($pm)
      or die "FatPacked INC entry failed?!";

    my ($tmp, $tmpfile) = tempfile( UNLINK => 1, TMPDIR => 1, SUFFIX => '.pm' );
    print { $tmp } $_ while <$source_fh>;
    close $tmp
      or die "failed to close tempfile $tmpfile after writing: $!";
    return $tmpfile;
  }
  else {
    die "Don't know how to read source of $class where \$INC{$pm} = $source";
  }
}

sub manual_class {
  my $this  = shift;
  my $page  = (split /::/, ref $this)[-1];
  my $class = "App::RecordStream::Manual::\u$page";
  my $pm = "$class.pm";
     $pm =~ s{::}{/}g;
  require $pm
    or die "Can't locate manual class $class: $!";
  return wantarray ? ($class, $pm) : $class;
}

1;
