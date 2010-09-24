package Recs::Operation::Printer;

use base qw(Recs::Operation);

use Recs::OutputStream;

sub init {
   my $this = shift;
   my $args = shift || [];

   $this->{'OUT'} = $args->[0] || Recs::OutputStream->new();
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   $this->{'OUT'}->put_record($record);
}

sub finish {
}

1;
