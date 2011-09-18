package App::RecordStream::Operation::Printer;

our $VERSION = "3.4";

use base qw(App::RecordStream::Operation);

use App::RecordStream::OutputStream;

sub init {
   my $this = shift;
   my $args = shift || [];

   $this->{'OUT'} = $args->[0] || App::RecordStream::OutputStream->new();
}

sub create_default_next {
   return '';
}

sub accept_record {
   $_[0]->{'OUT'}->put_record($_[1]);
}

sub finish {
}

1;
