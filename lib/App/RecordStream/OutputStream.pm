package App::RecordStream::OutputStream;

=head1 NAME

App::RecordStream::OutputStream

=head1 AUTHOR

Benjamin Bernard <perlhacker@benjaminbernard.com>
Keith Amling <keith.amling@gmail.com>

=head1 DESCRIPTION

The class responsible for knowing the conversion from in-memory
records to record stream wire format (currently JSON).

=head1 SYNOPSIS

    use App::RecordStream::OutputStream;

    my $string = App::RecordStream::OutputStream::hashref_string($record);


=head1 PUBLIC METHODS

=over 4

=item my $string = App::RecordStream::OutputStream::hashref_string($record);

Takes a record and produces the string format for passage between
recs processes.

=back

=cut

our $VERSION = "3.4";

use strict;
use warnings;

use JSON;

my $json = JSON::XS->new();
$json->allow_nonref(1);
$json->allow_blessed(1);
$json->convert_blessed(1);

sub hashref_string {
  my $record = shift;
  return $json->encode($record);
}

1;
