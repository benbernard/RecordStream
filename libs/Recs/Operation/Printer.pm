package Recs::Operation::Printer;

use base qw(Recs::Operation);

use Recs::OutputStream;

sub init {
   my $this = shift;
   my $args = shift || [];

   $this->{'OUT'} = $args->[0] || Recs::OutputStream->new();
}

sub accept_record {
   $_[0]->{'OUT'}->put_record($_[1]);
}

sub finish {
}

1;
