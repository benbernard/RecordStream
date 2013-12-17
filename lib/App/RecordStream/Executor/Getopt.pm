package App::RecordStream::Executor::Getopt;

use strict;
use warnings;

sub new {
  my $class = shift;

  my $this = {
    'STRINGS' => [],
    'MODULES' => [],
  };

  bless $this, $class;

  return $this;
}

sub arguments {
  my $this = shift;

  return (
    'e=s' => sub { $this->push_string($_[1]); },
    'E=s' => sub { $this->push_file($_[1]); },
    'M=s' => sub { $this->push_module($_[1], 1); },
    'm=s' => sub { $this->push_module($_[1], 0); },
  );
}

sub get_strings {
  my $this = shift;
  my $args = shift;

  my $strings = $this->{'STRINGS'};
  if(!@$strings) {
    if(!@$args) {
      die "Missing expression.\n";
    }
    push @$strings, shift @$args;
  }

  # Use map to avoid the undesired comma operator behaviour if we're ever
  # called in scalar context.  return @{[ ..., ... ]} could also be used.
  return map { @$_ } $this->{'MODULES'}, $strings;
}

sub get_string {
  my $this = shift;

  return join("", $this->get_strings(@_));
}

sub push_string {
  my $this = shift;
  my $string = shift;

  push @{$this->{'STRINGS'}}, $string;
}

sub push_file {
  my $this = shift;
  my $file = shift;

  my $string = $this->_slurp($file);

  push @{$this->{'STRINGS'}}, $string;
}

sub _slurp {
  my $this = shift;
  my $file = shift;

  local $/;
  undef $/;

  open (my $fh, '<', $file) or die "Could not open code snippet file: $file: $!";
  my $code = <$fh>;
  close $fh;

  return $code;
}

sub push_module {
    my $this              = shift;
    my ($module, $import) = split /=/, shift, 2;
    my $import_default    = shift;
    my $statement;

    if (defined $import) {
        # This syntax mimics the output of:
        #   perl -MO=Deparse -MList::Util=sum,max -e1
        $import =~ s/(?=[\\'])/\\/g;
        $statement = "use $module (split(/,/, '$import', 0));";
    } elsif ($import_default) {
        $statement = "use $module;";
    } else {
        $statement = "use $module ();";
    }

    push @{$this->{'MODULES'}}, $statement;
}

1;
