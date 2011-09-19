package App::RecordStream::OutputStream;

=head1 NAME

App::RecordStream::OutputStream

=head1 AUTHOR

Benjamin Bernard <perlhacker@benjaminbernard.com>
Keith Amling <keith.amling@gmail.com>

=head1 DESCRIPTION

An output stream for App::RecordStream::Record objects

=head1 SYNOPSIS

    use App::RecordStream::OutputStream;

    my $out    = App::RecordStream::OutputStream->new();

    my $record = App::RecordStream::Record->new("name" => "John Smith", "age" => 39);
    $out->put_record($record);

    my $hash = { foo => 'bar' };
    $out->put_hashref($hashref);


=head1 CONSTRUCTOR

=over 4

=item my $out = App::RecordStream::OutputStream->new(FH);

Takes an optional output file handle to print records to.  If none is
specified, will output to STDOUT

=back

=head1 PUBLIC METHODS

=over 4

=item $out->put_record(RECORD);

Takes a L<App::RecordStream::Record> object and puts it on the output file handle.

=item $out->put_hashref(HASH_REF);

Puts the HASH_REF on the output stream as a record.

=item $out->record_string(RECORD);

String representation of a record, what would be printed from put_record

=item $out->put_hashref(HASH_REF);

String representation of a hash ref, what would be printed from put_hashref

=back

=cut

our $VERSION = "3.4";

use strict;
use lib;

use JSON qw(encode_json);

our $AUTOLOAD;

sub new
{
   my $class = shift;
   my ($fh) = @_;

   $fh ||= \*STDOUT;

   my $json = JSON::XS->new();
   $json->allow_nonref(1);
   $json->allow_blessed(1);
   $json->convert_blessed(1);

   my $this =
   {
      'fh'   => $fh,
      'json' => $json,
   };

   bless $this, $class;

   return $this;
}

sub create_json {
  return $_[0]->{'json'}->encode($_[1]);
}

sub put_record {
   my ($this, $rec) = @_;

   my $fh   = $this->{'fh'};

   my $hash = { %$rec };
   print $fh $this->create_json($hash) . "\n";
}

sub put_hashref
{
   my ($this, $hr) = @_;

   my $fh = $this->{'fh'};
   print $fh $this->create_json($hr) . "\n";
}

sub record_string {
  my ($this, $rec) = @_;
  return $this->create_json($rec->as_hashref());
}

sub hashref_string {
  my ($this, $hr) = @_;
  return $this->create_json($hr);
}

1;
