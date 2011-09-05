package App::RecordStream::ScreenPrinter;

our $VERSION = "3.4";

sub get_printer {
   my $this = shift;
   $this->{'PRINTER'} ||= sub { print $_[0] };
   return $this->{'PRINTER'};
}

sub set_printer {
   my $this    = shift;
   my $printer = shift;
   $this->{'PRINTER'} = $printer;
}

sub print_value {
   my $this = shift;
   $this->get_printer()->(shift);
}

1;
