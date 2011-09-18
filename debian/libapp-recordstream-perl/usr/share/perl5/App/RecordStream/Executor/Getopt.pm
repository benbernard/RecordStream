package App::RecordStream::Executor::Getopt;

use strict;
use warnings;

sub new {
    my $class = shift;

    my $this = {
        'STRINGS' => [],
    };

    bless $this, $class;

    return $this;
}

sub arguments {
    my $this = shift;

    return (
        'e=s' => sub { $this->push_string($_[1]); },
        'E=s' => sub { $this->push_file($_[1]); },
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

    return @$strings;
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

1;
